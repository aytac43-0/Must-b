// swift-tools-version: 6.2
// Package manifest for the Must-b macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "MustB",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "MustBIPC", targets: ["MustBIPC"]),
        .library(name: "MustBDiscovery", targets: ["MustBDiscovery"]),
        .executable(name: "MustB", targets: ["MustB"]),
        .executable(name: "must-b-mac", targets: ["MustBMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/MustBKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "MustBIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MustBDiscovery",
            dependencies: [
                .product(name: "MustBKit", package: "MustBKit"),
            ],
            path: "Sources/MustBDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MustB",
            dependencies: [
                "MustBIPC",
                "MustBDiscovery",
                .product(name: "MustBKit", package: "MustBKit"),
                .product(name: "MustBChatUI", package: "MustBKit"),
                .product(name: "MustBProtocol", package: "MustBKit"),
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
                .copy("Resources/MustB.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MustBMacCLI",
            dependencies: [
                "MustBDiscovery",
                .product(name: "MustBKit", package: "MustBKit"),
                .product(name: "MustBProtocol", package: "MustBKit"),
            ],
            path: "Sources/MustBMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MustBIPCTests",
            dependencies: [
                "MustBIPC",
                "MustB",
                "MustBDiscovery",
                .product(name: "MustBProtocol", package: "MustBKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
