package com.saiteja.pdfscanner.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.saiteja.pdfscanner.ui.camera.CameraScreen
import com.saiteja.pdfscanner.ui.document.DocumentScreen
import com.saiteja.pdfscanner.ui.edit.EditPageScreen
import com.saiteja.pdfscanner.ui.home.HomeScreen

private object Routes {
    const val HOME = "home"
    const val CAMERA = "camera?docId={docId}"
    const val DOCUMENT = "document/{docId}"
    const val EDIT = "edit/{docId}/{pageId}"

    fun camera(docId: String? = null) = if (docId == null) "camera" else "camera?docId=$docId"
    fun document(docId: String) = "document/$docId"
    fun edit(docId: String, pageId: String) = "edit/$docId/$pageId"
}

@Composable
fun AppNavigation() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            HomeScreen(
                onScan = { nav.navigate(Routes.camera()) },
                onOpenDocument = { nav.navigate(Routes.document(it)) },
                onResumeDraft = { nav.navigate(Routes.document(it)) },
            )
        }
        composable(
            Routes.CAMERA,
            arguments = listOf(navArgument("docId") { type = NavType.StringType; nullable = true; defaultValue = null }),
        ) { entry ->
            val addingToExisting = entry.arguments?.getString("docId") != null
            CameraScreen(
                onFinished = { docId ->
                    when {
                        addingToExisting -> nav.popBackStack()
                        docId == null -> nav.popBackStack()
                        else -> nav.navigate(Routes.document(docId)) { popUpTo(Routes.CAMERA) { inclusive = true } }
                    }
                },
                onBack = { nav.popBackStack() },
            )
        }
        composable(Routes.DOCUMENT, arguments = listOf(navArgument("docId") { type = NavType.StringType })) {
            DocumentScreen(
                onBack = { nav.popBackStack() },
                onAddPages = { nav.navigate(Routes.camera(it)) },
                onEditPage = { docId, pageId -> nav.navigate(Routes.edit(docId, pageId)) },
            )
        }
        composable(
            Routes.EDIT,
            arguments = listOf(navArgument("docId") { type = NavType.StringType }, navArgument("pageId") { type = NavType.StringType }),
        ) {
            EditPageScreen(onClose = { nav.popBackStack() })
        }
    }
}
