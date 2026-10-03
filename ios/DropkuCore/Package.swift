// swift-tools-version: 5.9
// DropkuCore: the game rules, levels, Sparks economy and saved progress.
// No UI, so it can be unit-tested on a Mac with `swift test` and shared by the iPhone/iPad app.
import PackageDescription

let package = Package(
    name: "DropkuCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "DropkuCore", targets: ["DropkuCore"])
    ],
    targets: [
        .target(
            name: "DropkuCore",
            resources: [.copy("Resources/levels.json")]
        ),
        .testTarget(
            name: "DropkuCoreTests",
            dependencies: ["DropkuCore"]
        )
    ]
)
