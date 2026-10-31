package com.stor.android;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.IOException;
import java.io.InputStream;

/** Standalone test APK has no target-app Kotlin classpath. Keep this fixture platform-only. */
public class FixtureActivity extends Activity {
    private int index;
    private final String[] files = {"en", "zh", "ja"};
    private final String[] languages = {"英文", "中文", "日文"};
    private TextView title;
    private ImageView image;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        index = saved == null ? 0 : saved.getInt("sample");
        float density = getResources().getDisplayMetrics().density;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setPadding((int)(24*density), (int)(48*density), (int)(24*density), (int)(32*density));
        title = new TextView(this); title.setTextSize(22); title.setTextColor(Color.BLACK);
        image = new ImageView(this); image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        root.addView(title);
        root.addView(image, new LinearLayout.LayoutParams(-1, (int)(180*density)));
        Button next = new Button(this); next.setText("下一张样本");
        next.setOnClickListener(v -> { index = (index + 1) % files.length; refresh(); });
        root.addView(next);
        Button rotate = new Button(this); rotate.setText("切换横竖屏");
        rotate.setOnClickListener(v -> setRequestedOrientation(
            getResources().getConfiguration().orientation == Configuration.ORIENTATION_PORTRAIT
            ? ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        root.addView(rotate);
        TextView note = new TextView(this); note.setText("仅用于 STOR 真机验证，不含个人内容。");
        note.setTextColor(Color.DKGRAY); note.setTextSize(14); root.addView(note);
        setContentView(root); refresh();
    }

    private void refresh() {
        title.setText("STOR 合成样本 / " + languages[index]);
        image.setContentDescription(languages[index] + "合成文字图片");
        try (InputStream input = getAssets().open("fixtures/" + files[index] + ".png")) {
            image.setImageBitmap(BitmapFactory.decodeStream(input));
        } catch (IOException error) { throw new IllegalStateException("Missing synthetic fixture", error); }
    }
    @Override protected void onSaveInstanceState(Bundle state) { state.putInt("sample", index); super.onSaveInstanceState(state); }
}
