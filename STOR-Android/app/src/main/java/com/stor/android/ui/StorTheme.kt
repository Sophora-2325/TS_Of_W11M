package com.stor.android.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.size
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.stor.android.R

@OptIn(ExperimentalTextApi::class)
private val storFont = FontFamily(
    Font(R.font.noto_sans_sc, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.noto_sans_sc, FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.noto_sans_sc, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.noto_sans_sc, FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))),
)

@Composable
fun StorTheme(content: @Composable () -> Unit) {
    val background = colorResource(R.color.stor_background)
    val surface = colorResource(R.color.stor_surface)
    val primary = colorResource(R.color.stor_primary)
    val ink = colorResource(R.color.stor_ink)
    val muted = colorResource(R.color.stor_muted)
    val outline = colorResource(R.color.stor_outline)
    val colors = MaterialTheme.colorScheme.copy(
        primary = primary, onPrimary = colorResource(R.color.stor_on_primary),
        primaryContainer = surface, onPrimaryContainer = ink,
        secondary = primary, onSecondary = colorResource(R.color.stor_on_primary),
        secondaryContainer = surface, onSecondaryContainer = ink,
        tertiary = primary, onTertiary = colorResource(R.color.stor_on_primary),
        tertiaryContainer = surface, onTertiaryContainer = ink,
        background = background, onBackground = ink, surface = background, onSurface = ink,
        surfaceVariant = surface, onSurfaceVariant = muted, surfaceTint = primary,
        surfaceContainerLowest = background, surfaceContainerLow = surface,
        surfaceContainer = surface, surfaceContainerHigh = surface, surfaceContainerHighest = surface,
        outline = outline, outlineVariant = outline, error = colorResource(R.color.stor_error),
    )
    val typography = Typography(
        displaySmall = TextStyle(fontFamily = storFont, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, lineHeight = 38.sp),
        headlineSmall = TextStyle(fontFamily = storFont, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 32.sp),
        titleLarge = TextStyle(fontFamily = storFont, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 28.sp),
        titleMedium = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 24.sp),
        titleSmall = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
        bodyLarge = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
        bodyMedium = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
        bodySmall = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 18.sp),
        labelLarge = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
        labelMedium = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 18.sp),
        labelSmall = TextStyle(fontFamily = storFont, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 18.sp),
    )
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}

@Composable
fun StorIcon(@DrawableRes resource: Int, description: String? = null) {
    Icon(painterResource(resource), description, Modifier.size(22.dp))
}
