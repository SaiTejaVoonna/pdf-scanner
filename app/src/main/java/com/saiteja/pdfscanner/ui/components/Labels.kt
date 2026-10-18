package com.saiteja.pdfscanner.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.PdfQuality

@Composable
fun PageFilter.label(): String = stringResource(
    when (this) {
        PageFilter.ORIGINAL -> R.string.filter_original
        PageFilter.ENHANCED -> R.string.filter_enhanced
        PageFilter.GRAYSCALE -> R.string.filter_grayscale
        PageFilter.BLACK_WHITE -> R.string.filter_bw
    },
)

@Composable
fun PdfPageSize.label(): String = stringResource(
    when (this) {
        PdfPageSize.A4 -> R.string.size_a4
        PdfPageSize.LETTER -> R.string.size_letter
        PdfPageSize.MATCH_IMAGE -> R.string.size_match
    },
)

@Composable
fun PdfQuality.label(): String = stringResource(
    when (this) {
        PdfQuality.HIGH -> R.string.quality_high
        PdfQuality.BALANCED -> R.string.quality_balanced
        PdfQuality.SMALL -> R.string.quality_small
    },
)
