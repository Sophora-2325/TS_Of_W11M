use image::DynamicImage;

pub fn preprocess_for_ocr(image: &DynamicImage) -> DynamicImage {
    // PP-OCR owns resizing/normalization. Preserve native pixels and colored text.
    // Screen captures may have zero alpha even when RGB contains valid pixels.
    DynamicImage::ImageRgb8(image.to_rgb8())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_native_size_and_rgb_even_when_capture_alpha_is_zero() {
        let source = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(12, 8, image::Rgba([15, 90, 220, 0])));
        let output = preprocess_for_ocr(&source).to_rgb8();
        assert_eq!(output.dimensions(), (12, 8));
        assert_eq!(output.get_pixel(0, 0).0, [15, 90, 220]);
    }
}
