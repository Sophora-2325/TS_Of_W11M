# 见译 · 软件命名与 Logo

软件名：**见译**。英文/工程标识沿用 STOR。

含义：看见文字，读懂意思。名称贴合屏幕框选、识别及翻译的核心用途；读音为 jiàn yì。

Logo：以「见」为主体，结合取景框和两行文字，表达看见、识别、理解；延续现有石墨灰与鼠尾草绿。主体粗细适合小尺寸图标，方形底图便于后续适配 Android 图标蒙版。

交付文件：`jianyi-logo-concept.png`，由内置 imagegen 生成并完成视觉检查。本轮为命名与 Logo 设计稿，未涉及商标或重名检索。

## 生成方式

工具：内置 image_gen.imagegen；非 CLI/API 备用模式。

## 完整生成提示词

Use case: logo-brand.
Asset type: final proposed Android launcher icon for a screen OCR and translation app named 见译 (internal project STOR).
Primary request: Design one distinctive, highly resolved minimalist app icon, suitable for an independent premium reading/translation utility. This is the actual standalone icon asset, not a mockup or presentation sheet.
Composition: square 1:1 canvas completely filled with uniform muted sage green #B9CBA9, no exterior margin, no rounded tile boundary (Android applies its own mask). One central strong graphite #19251B original symbol, occupying about 60 percent of canvas, with ample equal safe area for Android adaptive icon cropping.
Symbol concept: a custom geometric monogram inspired by the Chinese character 见 (seeing), merged subtly with a viewfinder and a readable page. A single friendly thick rounded rectangular frame with two short horizontal reading slots in the upper region, opening at the bottom into two clean flowing legs inspired by 见, with the right leg turning gently upward like an open page corner. The symbol must feel coherent, intentional, and recognizable at 32 pixels. Do not literally typeset the character; create an original elegant designed glyph. Optical balance, generously rounded inside corners, consistent substantial stroke/shape weight, clean negative space.
Style: absolutely flat, clean vector-like logo, exact solid two-color palette, understated and warm. No gradients, no shadows, no glossy/3D effects, no textures, no metallic surface, no outlines around the canvas.
Text: none. No wordmark, no English letters, no captions or watermark.
Avoid: generic Google Translate A/文 pictogram, globe, flags, speech bubble stack, sparkles, leaves, eye illustration, camera lens, complex fine lines. One icon only, no variations or collage.


## Android 落地

0.2.0-internal.3 / versionCode 5 已应用软件名称与桌面 Logo，沿用 com.stor.android 及原签名。桌面使用原 PNG，自适应蒙版由 Android 处理；通知及主题图标使用对应单色矢量。详见 docs/release/BRANDING_VERIFICATION.md。
