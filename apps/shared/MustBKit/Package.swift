// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "Must-bKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "Must-bProtocol", targets: ["Must-bProtocol"]),
        .library(name: "Must-bKit", targets: ["Must-bKit"]),
        .library(name: "Must-bChatUI", targets: ["Must-bChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "Must-bProtocol",
            path: "Sources/Must-bProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "Must-bKit",
            dependencies: [
                "Must-bProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/Must-bKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "Must-bChatUI",
            dependencies: [
                "Must-bKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/Must-bChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "Must-bKitTests",
            dependencies: ["Must-bKit", "Must-bChatUI"],
            path: "Tests/Must-bKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
