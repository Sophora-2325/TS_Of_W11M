use super::screen::MonitorBounds;
use std::time::{Duration, Instant};

pub const PREPARE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureMode {
    Freeze,
    Live,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SessionPhase {
    Preparing,
    AwaitingFrontend,
    Showing,
    Shown,
    Cancelled,
    Finished,
}

#[derive(Clone, Debug)]
pub struct SessionRequest {
    pub mode: CaptureMode,
    pub bounds: MonitorBounds,
    pub scale_factor: f64,
    pub popup_held: bool,
}

#[derive(Clone, Debug)]
pub struct LiveSession {
    pub id: u64,
    pub mode: CaptureMode,
    pub bounds: MonitorBounds,
    pub scale_factor: f64,
    pub phase: SessionPhase,
    pub popup_held: bool,
    pub frontend_ready: bool,
    pub image_ok: Option<bool>,
    pub started: Instant,
    pub width: u32,
    pub height: u32,
    pub freeze_jpeg: Option<Vec<u8>>,
}

#[derive(Clone, Debug)]
pub struct BeginResult {
    pub id: u64,
    pub started: Instant,
    pub leader: bool,
    pub replaced: Option<u64>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PublishResult {
    Accepted,
    Discarded,
}

#[derive(Clone, Debug)]
pub struct PendingView {
    pub id: u64,
    pub mode: CaptureMode,
    pub bounds: MonitorBounds,
    pub scale_factor: f64,
    pub freeze_jpeg: Option<Vec<u8>>,
}

#[derive(Clone, Debug)]
pub struct ShowPlan {
    pub id: u64,
    pub close_popup: bool,
    pub bounds: MonitorBounds,
}

#[derive(Clone, Debug)]
pub struct FailurePlan {
    pub id: u64,
    pub popup_held: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImageAck {
    Ignored,
    Updated,
    Failed,
}

pub struct SessionBook {
    next_id: u64,
    active: Option<LiveSession>,
}

impl SessionBook {
    pub fn new() -> Self {
        Self { next_id: 1, active: None }
    }

    pub fn begin(&mut self, request: SessionRequest, now: Instant) -> BeginResult {
        if let Some(active) = &self.active {
            if matches!(
                active.phase,
                SessionPhase::Preparing | SessionPhase::AwaitingFrontend | SessionPhase::Showing
            ) {
                return BeginResult {
                    id: active.id,
                    started: active.started,
                    leader: false,
                    replaced: None,
                };
            }
        }
        let id = self.next_id;
        self.next_id = self.next_id.saturating_add(1);
        let replaced = self.active.as_ref().map(|session| session.id);
        self.active = Some(LiveSession {
            id,
            mode: request.mode,
            bounds: request.bounds,
            scale_factor: request.scale_factor,
            phase: SessionPhase::Preparing,
            popup_held: request.popup_held,
            frontend_ready: false,
            image_ok: None,
            started: now,
            width: 0,
            height: 0,
            freeze_jpeg: None,
        });
        BeginResult { id, started: now, leader: true, replaced }
    }

    pub fn set_scale(&mut self, id: u64, scale: f64) -> bool {
        let Some(session) = self.active.as_mut() else {
            return false;
        };
        if session.id != id || session.phase != SessionPhase::Preparing {
            return false;
        }
        session.scale_factor = scale;
        true
    }

    pub fn publish(&mut self, id: u64, jpeg: Option<Vec<u8>>, width: u32, height: u32) -> PublishResult {
        let Some(session) = self.active.as_mut() else {
            return PublishResult::Discarded;
        };
        if session.id != id || session.phase != SessionPhase::Preparing {
            return PublishResult::Discarded;
        }
        if session.mode == CaptureMode::Freeze && jpeg.is_none() {
            return PublishResult::Discarded;
        }
        session.freeze_jpeg = jpeg;
        session.width = width;
        session.height = height;
        session.phase = SessionPhase::AwaitingFrontend;
        PublishResult::Accepted
    }

    pub fn pending(&self) -> Option<PendingView> {
        let session = self.active.as_ref()?;
        if !matches!(
            session.phase,
            SessionPhase::AwaitingFrontend | SessionPhase::Showing | SessionPhase::Shown
        ) {
            return None;
        }
        if session.mode == CaptureMode::Freeze && session.freeze_jpeg.is_none() {
            return None;
        }
        Some(PendingView {
            id: session.id,
            mode: session.mode,
            bounds: session.bounds.clone(),
            scale_factor: session.scale_factor,
            freeze_jpeg: session.freeze_jpeg.clone(),
        })
    }

    pub fn ack_frontend(&mut self, id: u64) -> bool {
        let Some(session) = self.active.as_mut() else {
            return false;
        };
        if session.id != id || !matches!(session.phase, SessionPhase::AwaitingFrontend | SessionPhase::Showing) {
            return false;
        }
        session.frontend_ready = true;
        true
    }

    pub fn ack_image(&mut self, id: u64, ok: bool) -> ImageAck {
        let Some(session) = self.active.as_mut() else {
            return ImageAck::Ignored;
        };
        if session.id != id || session.mode != CaptureMode::Freeze {
            return ImageAck::Ignored;
        }
        if !matches!(session.phase, SessionPhase::AwaitingFrontend | SessionPhase::Showing) {
            return ImageAck::Ignored;
        }
        if session.image_ok == Some(true) && ok {
            return ImageAck::Updated;
        }
        if !ok {
            return ImageAck::Failed;
        }
        session.image_ok = Some(true);
        ImageAck::Updated
    }

    pub fn ready_to_show(&self, id: u64) -> bool {
        let Some(session) = &self.active else {
            return false;
        };
        session.id == id
            && session.phase == SessionPhase::AwaitingFrontend
            && session.frontend_ready
            && match session.mode {
                CaptureMode::Live => true,
                CaptureMode::Freeze => session.image_ok == Some(true),
            }
    }

    pub fn begin_show(&mut self, id: u64) -> Option<ShowPlan> {
        if !self.ready_to_show(id) {
            return None;
        }
        let session = self.active.as_mut()?;
        let close_popup = session.popup_held;
        session.phase = SessionPhase::Showing;
        Some(ShowPlan {
            id,
            close_popup,
            bounds: session.bounds.clone(),
        })
    }

    pub fn mark_shown(&mut self, id: u64) -> bool {
        let Some(session) = self.active.as_mut() else {
            return false;
        };
        if session.id != id || session.phase != SessionPhase::Showing {
            return false;
        }
        session.phase = SessionPhase::Shown;
        session.popup_held = false;
        true
    }

    pub fn accepts_ocr(&self, id: u64) -> bool {
        matches!(&self.active, Some(session) if session.id == id && session.phase == SessionPhase::Shown)
    }

    pub fn ocr_target(&self, id: u64) -> Option<(CaptureMode, MonitorBounds)> {
        let session = self.active.as_ref()?;
        if session.id != id || session.phase != SessionPhase::Shown {
            return None;
        }
        Some((session.mode, session.bounds.clone()))
    }

    pub fn finish(&mut self, id: u64) -> bool {
        let Some(session) = self.active.as_mut() else {
            return false;
        };
        if session.id != id || session.phase != SessionPhase::Shown {
            return false;
        }
        session.phase = SessionPhase::Finished;
        session.freeze_jpeg = None;
        true
    }

    pub fn expire_prepare(&mut self, id: u64, now: Instant) -> Option<FailurePlan> {
        let session = self.active.as_mut()?;
        if session.id != id {
            return None;
        }
        if !matches!(
            session.phase,
            SessionPhase::Preparing | SessionPhase::AwaitingFrontend | SessionPhase::Showing
        ) {
            return None;
        }
        if now.saturating_duration_since(session.started) < PREPARE_TIMEOUT {
            return None;
        }
        Some(self.cancel_current())
    }

    /// 准备等待已经到达截止时间。不会取消已经显示或已经被替代的选区。
    pub fn cancel_prepare(&mut self, id: u64) -> Option<FailurePlan> {
        let session = self.active.as_mut()?;
        if session.id != id {
            return None;
        }
        if !matches!(
            session.phase,
            SessionPhase::Preparing | SessionPhase::AwaitingFrontend | SessionPhase::Showing
        ) {
            return None;
        }
        Some(self.cancel_current())
    }

    pub fn fail_active(&mut self, id: u64) -> Option<FailurePlan> {
        let session = self.active.as_mut()?;
        if session.id != id {
            return None;
        }
        if !matches!(
            session.phase,
            SessionPhase::Preparing | SessionPhase::AwaitingFrontend | SessionPhase::Showing | SessionPhase::Shown
        ) {
            return None;
        }
        Some(self.cancel_current())
    }

    fn cancel_current(&mut self) -> FailurePlan {
        let session = self.active.as_mut().expect("active session");
        let plan = FailurePlan { id: session.id, popup_held: session.popup_held };
        session.phase = SessionPhase::Cancelled;
        session.freeze_jpeg = None;
        session.popup_held = false;
        plan
    }

    pub fn is_current(&self, id: u64) -> bool {
        self.active.as_ref().is_some_and(|session| session.id == id)
    }

    pub fn started_at(&self, id: u64) -> Option<Instant> {
        self.active.as_ref().filter(|session| session.id == id).map(|session| session.started)
    }

    pub fn phase(&self, id: u64) -> Option<SessionPhase> {
        self.active.as_ref().filter(|session| session.id == id).map(|session| session.phase)
    }
}

pub fn ocr_uses_frozen_cache(mode: CaptureMode) -> bool {
    matches!(mode, CaptureMode::Freeze)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bounds() -> MonitorBounds {
        MonitorBounds { x: 0, y: 0, width: 100, height: 80 }
    }

    fn request(mode: CaptureMode, popup_held: bool) -> SessionRequest {
        SessionRequest { mode, bounds: bounds(), scale_factor: 1.5, popup_held }
    }

    fn publish_freeze(book: &mut SessionBook, id: u64) {
        assert_eq!(book.publish(id, Some(vec![1, 2, 3]), 100, 80), PublishResult::Accepted);
    }

    #[test]
    fn late_listener_reads_complete_pending_payload() {
        let mut book = SessionBook::new();
        let begun = book.begin(request(CaptureMode::Freeze, false), Instant::now());
        assert!(book.pending().is_none(), "捕获完成前没有完整初始化数据");
        publish_freeze(&mut book, begun.id);
        let pending = book.pending().unwrap();
        assert_eq!(pending.id, begun.id);
        assert_eq!(pending.mode, CaptureMode::Freeze);
        assert_eq!(pending.bounds, bounds());
        assert_eq!(pending.scale_factor, 1.5);
        assert_eq!(pending.freeze_jpeg.as_deref(), Some(&[1, 2, 3][..]));
    }

    #[test]
    fn repeated_trigger_while_preparing_joins_the_same_session() {
        let mut book = SessionBook::new();
        let first = book.begin(request(CaptureMode::Freeze, true), Instant::now());
        let second = book.begin(request(CaptureMode::Live, false), Instant::now());
        assert!(first.leader);
        assert!(!second.leader);
        assert_eq!(first.id, second.id);
        assert_eq!(book.pending().is_none(), true);
        publish_freeze(&mut book, first.id);
        assert_eq!(book.pending().unwrap().mode, CaptureMode::Freeze);
    }

    #[test]
    fn trigger_while_shown_starts_a_new_session_and_discards_the_old_result() {
        let mut book = SessionBook::new();
        let now = Instant::now();
        let first = book.begin(request(CaptureMode::Freeze, false), now);
        publish_freeze(&mut book, first.id);
        book.ack_frontend(first.id);
        book.ack_image(first.id, true);
        assert!(book.begin_show(first.id).is_some());
        assert!(book.mark_shown(first.id));
        let second = book.begin(request(CaptureMode::Freeze, false), now);
        assert!(second.leader);
        assert_ne!(first.id, second.id);
        assert_eq!(second.replaced, Some(first.id));
        assert_eq!(book.publish(first.id, Some(vec![9]), 10, 10), PublishResult::Discarded);
        assert!(book.pending().is_none());
        assert!(!book.accepts_ocr(first.id));
    }

    #[test]
    fn stale_ack_and_cancelled_publish_do_not_change_the_new_session() {
        let mut book = SessionBook::new();
        let now = Instant::now();
        let first = book.begin(request(CaptureMode::Freeze, false), now);
        book.fail_active(first.id);
        assert_eq!(book.publish(first.id, Some(vec![4]), 8, 8), PublishResult::Discarded);
        let second = book.begin(request(CaptureMode::Live, false), now);
        assert_eq!(book.publish(second.id, None, 0, 0), PublishResult::Accepted);
        assert!(!book.ack_frontend(first.id));
        assert_eq!(book.ack_image(first.id, true), ImageAck::Ignored);
        assert_eq!(book.ack_image(first.id, false), ImageAck::Ignored);
        book.ack_frontend(second.id);
        assert!(book.ready_to_show(second.id));
        assert_eq!(book.pending().unwrap().id, second.id);
    }

    #[test]
    fn image_failure_is_not_ready_and_live_mode_does_not_wait_for_an_image() {
        let mut freeze = SessionBook::new();
        let begun = freeze.begin(request(CaptureMode::Freeze, true), Instant::now());
        publish_freeze(&mut freeze, begun.id);
        freeze.ack_frontend(begun.id);
        assert!(!freeze.ready_to_show(begun.id));
        assert_eq!(freeze.ack_image(begun.id, false), ImageAck::Failed);
        let plan = freeze.fail_active(begun.id).unwrap();
        assert!(plan.popup_held);
        assert!(!freeze.ready_to_show(begun.id));
        assert!(freeze.pending().is_none());

        let mut live = SessionBook::new();
        let live_begun = live.begin(request(CaptureMode::Live, false), Instant::now());
        assert_eq!(live.publish(live_begun.id, None, 0, 0), PublishResult::Accepted);
        assert!(!live.ready_to_show(live_begun.id));
        live.ack_frontend(live_begun.id);
        assert!(live.ready_to_show(live_begun.id));
        assert!(!ocr_uses_frozen_cache(CaptureMode::Live));
        assert!(ocr_uses_frozen_cache(CaptureMode::Freeze));
    }

    #[test]
    fn timeout_of_an_old_session_does_not_cancel_a_later_one() {
        let mut book = SessionBook::new();
        let started = Instant::now();
        let old = book.begin(request(CaptureMode::Freeze, true), started);
        publish_freeze(&mut book, old.id);
        book.ack_frontend(old.id);
        book.ack_image(old.id, true);
        assert!(book.begin_show(old.id).is_some());
        assert!(book.mark_shown(old.id));
        let later = started + Duration::from_secs(11);
        let new_session = book.begin(request(CaptureMode::Live, false), later);
        assert_ne!(old.id, new_session.id);
        assert!(book.expire_prepare(old.id, later).is_none());
        assert!(book.cancel_prepare(old.id).is_none());
        assert_eq!(book.publish(new_session.id, None, 0, 0), PublishResult::Accepted);
        book.ack_frontend(new_session.id);
        assert!(book.ready_to_show(new_session.id));
        assert!(book.expire_prepare(new_session.id, later).is_none());
        assert!(book.expire_prepare(new_session.id, later + PREPARE_TIMEOUT).is_some());
        assert!(!book.is_current(old.id));
        assert_eq!(book.phase(new_session.id), Some(SessionPhase::Cancelled));
    }

    #[test]
    fn old_ocr_is_rejected_after_replacement_and_finish() {
        let mut book = SessionBook::new();
        let now = Instant::now();
        let first = book.begin(request(CaptureMode::Freeze, false), now);
        publish_freeze(&mut book, first.id);
        book.ack_frontend(first.id);
        book.ack_image(first.id, true);
        book.begin_show(first.id);
        book.mark_shown(first.id);
        assert!(book.accepts_ocr(first.id));
        let second = book.begin(request(CaptureMode::Freeze, false), now);
        assert!(!book.accepts_ocr(first.id));
        assert!(book.ocr_target(first.id).is_none());
        publish_freeze(&mut book, second.id);
        book.ack_frontend(second.id);
        book.ack_image(second.id, true);
        book.begin_show(second.id);
        book.mark_shown(second.id);
        assert!(book.finish(second.id));
        assert!(!book.accepts_ocr(second.id));
        assert!(!book.finish(second.id));
    }
}
