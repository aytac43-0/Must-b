import Foundation

public enum MustBLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
