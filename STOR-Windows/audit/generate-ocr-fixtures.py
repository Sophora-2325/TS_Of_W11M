from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
out=Path(__file__).parent/'evidence'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',36)
for lang,text in [('en','Hello adventurer Quest complete'),('zh','冒险者你好 请接受新的任务'),('ja','冒険者よ 新しい世界へ')]:
    image=Image.new('RGB',(1000,100),'white')
    ImageDraw.Draw(image).text((20,20),text,font=font,fill='black')
    image.save(out/f'ocr-{lang}.png')
