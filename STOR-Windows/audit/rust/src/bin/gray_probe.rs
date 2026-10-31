#![allow(dead_code)]
mod capture {
    pub mod preprocess {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/capture/preprocess.rs"));
    }
    pub mod screen {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/capture/screen.rs"));

        #[test]
        fn gray_probe_jpeg_preserves_color_when_gdi_alpha_is_zero() {
            let image = image::RgbaImage::from_fn(64, 32, |x, _| {
                if x < 32 { image::Rgba([220, 50, 50, 0]) }
                else { image::Rgba([30, 100, 220, 0]) }
            });
            let cache = MonitorSnapshotCache::new();
            cache.store(MonitorBounds {x: 0, y: 0, width: 64, height: 32}, 64, 32, image.into_raw());
            let jpeg = encode_freeze_frame_jpeg(&cache).unwrap();
            let decoded = image::load_from_memory(&jpeg).unwrap().to_rgb8();
            let left = decoded.get_pixel(16, 16);
            let right = decoded.get_pixel(48, 16);
            assert!(left[0] > left[2].saturating_add(100));
            assert!(right[2] > right[0].saturating_add(100));
        }
    }
}
fn main() {}
