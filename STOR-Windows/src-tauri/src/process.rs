use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::process::Child;
use windows::Win32::Foundation::HANDLE;
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

// Closing the owning STOR process also closes this job and its children.
pub(crate) fn own_process(child: &Child) -> Result<OwnedHandle, String> {
    unsafe {
        let job = CreateJobObjectW(None, None).map_err(|e| format!("进程管理初始化失败: {e}"))?;
        let owned = OwnedHandle::from_raw_handle(job.0);
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const _,
            std::mem::size_of_val(&limits) as u32,
        )
        .map_err(|e| format!("进程管理配置失败: {e}"))?;
        AssignProcessToJobObject(job, HANDLE(child.as_raw_handle()))
            .map_err(|e| format!("子进程管理失败: {e}"))?;
        Ok(owned)
    }
}
