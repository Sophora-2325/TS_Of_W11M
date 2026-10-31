mod ocr {
include!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../src-tauri/src/ocr/windows_ocr.rs"));
#[test] fn installed_ocr_and_recognition_diagnostic() {
 let langs=OcrEngine::AvailableRecognizerLanguages().unwrap();
 let mut tags=Vec::new(); for i in 0..langs.Size().unwrap() {tags.push(langs.GetAt(i).unwrap().LanguageTag().unwrap().to_string());}
 eprintln!("Available OCR languages: {:?}; max image dimension {:?}",tags,OcrEngine::MaxImageDimension());
 for (lang,tag) in [("en",LANG_EN),("zh",LANG_ZH),("ja",LANG_JA)] {
   let path=format!("{}/../evidence/ocr-{}.png",env!("CARGO_MANIFEST_DIR"),lang);
   let png=std::fs::read(path).unwrap();
   eprintln!("fixture={lang}; engine={:?}; selected={:?}; auto={:?}",ocr_with_language(&png,tag),recognize_text(&png,lang),recognize_text(&png,"auto"));
 }
}
}
