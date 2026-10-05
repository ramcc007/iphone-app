// swift-tools-version: 5.9
// NumfallCore: the game rules, levels, Sparks economy and saved progress.
// No UI, so it can be unit-tested on a Mac with `swift test` and shared by the iPhone/iPad app.
import PackageDescription

let package = Package(
    name: "NumfallCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "NumfallCore", targets: ["NumfallCore"])
    ],
    targets: [
        .target(
            name: "NumfallCore",
            resources: [.copy("Resources/levels.json")]
        ),
        .testTarget(
            name: "NumfallCoreTests",
            dependencies: ["NumfallCore"]
        )
    ]
)
