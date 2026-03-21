import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-must-b writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.must-b.mac"
let gatewayLaunchdLabel = "ai.must-b.gateway"
let onboardingVersionKey = "must-b.onboardingVersion"
let onboardingSeenKey = "must-b.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "must-b.pauseEnabled"
let iconAnimationsEnabledKey = "must-b.iconAnimationsEnabled"
let swabbleEnabledKey = "must-b.swabbleEnabled"
let swabbleTriggersKey = "must-b.swabbleTriggers"
let voiceWakeTriggerChimeKey = "must-b.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "must-b.voiceWakeSendChime"
let showDockIconKey = "must-b.showDockIcon"
let defaultVoiceWakeTriggers = ["must-b"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "must-b.voiceWakeMicID"
let voiceWakeMicNameKey = "must-b.voiceWakeMicName"
let voiceWakeLocaleKey = "must-b.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "must-b.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "must-b.voicePushToTalkEnabled"
let talkEnabledKey = "must-b.talkEnabled"
let iconOverrideKey = "must-b.iconOverride"
let connectionModeKey = "must-b.connectionMode"
let remoteTargetKey = "must-b.remoteTarget"
let remoteIdentityKey = "must-b.remoteIdentity"
let remoteProjectRootKey = "must-b.remoteProjectRoot"
let remoteCliPathKey = "must-b.remoteCliPath"
let canvasEnabledKey = "must-b.canvasEnabled"
let cameraEnabledKey = "must-b.cameraEnabled"
let systemRunPolicyKey = "must-b.systemRunPolicy"
let systemRunAllowlistKey = "must-b.systemRunAllowlist"
let systemRunEnabledKey = "must-b.systemRunEnabled"
let locationModeKey = "must-b.locationMode"
let locationPreciseKey = "must-b.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "must-b.peekabooBridgeEnabled"
let deepLinkKeyKey = "must-b.deepLinkKey"
let modelCatalogPathKey = "must-b.modelCatalogPath"
let modelCatalogReloadKey = "must-b.modelCatalogReload"
let cliInstallPromptedVersionKey = "must-b.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "must-b.heartbeatsEnabled"
let debugPaneEnabledKey = "must-b.debugPaneEnabled"
let debugFileLogEnabledKey = "must-b.debug.fileLogEnabled"
let appLogLevelKey = "must-b.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
