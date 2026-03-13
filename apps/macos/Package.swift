// swift-tools-version: 6.2
// Package manifest for the Must-b macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Must-b",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "Must-bIPC", targets: ["Must-bIPC"]),
        .library(name: "Must-bDiscovery", targets: ["Must-bDiscovery"]),
        .executable(name: "Must-b", targets: ["Must-b"]),
        .executable(name: "must-b-mac", targets: ["Must-bMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/Must-bKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "Must-bIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "Must-bDiscovery",
            dependencies: [
                .product(name: "Must-bKit", package: "Must-bKit"),
            ],
            path: "Sources/Must-bDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Must-b",
            dependencies: [
                "Must-bIPC",
                "Must-bDiscovery",
                .product(name: "Must-bKit", package: "Must-bKit"),
                .product(name: "Must-bChatUI", package: "Must-bKit"),
                .product(name: "Must-bProtocol", package: "Must-bKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/Must-b.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Must-bMacCLI",
            dependencies: [
                "Must-bDiscovery",
                .product(name: "Must-bKit", package: "Must-bKit"),
                .product(name: "Must-bProtocol", package: "Must-bKit"),
            ],
            path: "Sources/Must-bMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "Must-bIPCTests",
            dependencies: [
                "Must-bIPC",
                "Must-b",
                "Must-bDiscovery",
                .product(name: "Must-bProtocol", package: "Must-bKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
