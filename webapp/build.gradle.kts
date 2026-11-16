// The Android app that ships the web app (web/) inside a WebView: same screens, same engine, fully offline.
// Build the web app first (cd web && npm ci && npm run build); its dist/ folder is packed as assets/www.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

val webDist = rootProject.file("web/dist")
val webVersion = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"").find(rootProject.file("web/package.json").readText())!!.groupValues[1]

val copyWebApp by tasks.registering(Sync::class) {
    doFirst { check(File(webDist, "index.html").exists()) { "web/dist is missing: run `npm ci && npm run build` in web/ first" } }
    from(webDist) { exclude("sw.js") } // no service worker inside the app: the files are already on the phone
    into(layout.buildDirectory.dir("generated/webAssets/www"))
}

android {
    namespace = "com.saiteja.pdfscanner.shell"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.saiteja.pdfscanner.web"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = webVersion
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webAssets"))
    lint { abortOnError = true }
}

tasks.named("preBuild") { dependsOn(copyWebApp) }

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
}
