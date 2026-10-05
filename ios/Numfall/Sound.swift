import AVFoundation

/// Every sound in the game. All of them are synthesised in code at launch (no audio files), so there is nothing to license.
enum SoundEffect: Hashable {
    case pick, land, line, double, triple, crack, win, lose, tick, chest
    case star(Int)
}

/// Small sound engine: pre-renders each effect once, then plays it on one of four player nodes (so sounds can overlap).
/// Uses the "ambient" audio category: it respects the silent switch, never interrupts the player's own music
/// and stays quiet when the sound setting is off.
@MainActor
final class SoundEngine {
    static let shared = SoundEngine()

    var enabled = true
    private let sampleRate = 44100.0
    private let engine = AVAudioEngine()
    private var players: [AVAudioPlayerNode] = []
    private var buffers: [SoundEffect: AVAudioPCMBuffer] = [:]
    private var next = 0
    private var prepared = false
    private lazy var format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!

    func play(_ effect: SoundEffect) {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-NumfallScene") { return }   // CI screenshots stay silent
        #endif
        guard enabled else { return }
        prepare()
        guard prepared else { return }
        if !engine.isRunning { try? engine.start() }
        guard engine.isRunning, let buffer = buffer(for: effect) else { return }
        let node = players[next]
        next = (next + 1) % players.count
        node.scheduleBuffer(buffer, at: nil, options: .interrupts)
        if !node.isPlaying { node.play() }
    }

    private func prepare() {
        guard !prepared else { return }
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        for _ in 0..<4 {
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: engine.mainMixerNode, format: format)
            players.append(node)
        }
        engine.mainMixerNode.outputVolume = 0.8
        prepared = true
    }

    private func buffer(for effect: SoundEffect) -> AVAudioPCMBuffer? {
        if let cached = buffers[effect] { return cached }
        let made = render(effect)
        buffers[effect] = made
        return made
    }

    // MARK: - Synthesis

    /// A soft bell: a sine with a quiet octave above it, a quick attack and an exponential fade.
    private func note(_ frequency: Double, at t: Double, decay: Double, volume: Double = 1) -> Double {
        guard t >= 0 else { return 0 }
        let attack = 1 - exp(-t * 600)
        let fade = exp(-t * decay)
        let tone = sin(2 * .pi * frequency * t) + 0.3 * sin(4 * .pi * frequency * t) * exp(-t * decay * 0.6)
        return tone * attack * fade * volume
    }

    /// Deterministic noise, so a sound is identical every time.
    private func noise(_ index: Int) -> Double {
        var x = UInt32(truncatingIfNeeded: index &* 2654435761)
        x ^= x << 13; x ^= x >> 17; x ^= x << 5
        return Double(x % 20001) / 10000.0 - 1.0
    }

    private func render(_ effect: SoundEffect) -> AVAudioPCMBuffer? {
        let duration: Double
        let sample: (Int, Double) -> Double   // (frame index, seconds) -> -1...1
        switch effect {
        case .pick:
            duration = 0.07
            sample = { [self] _, t in note(880, at: t, decay: 45, volume: 0.35) }
        case .land:
            duration = 0.12
            var phase = 0.0
            sample = { [self] i, t in
                phase += 2 * .pi * (60 + 120 * exp(-t * 22)) / sampleRate
                return sin(phase) * exp(-t * 26) * 0.9 + noise(i) * exp(-t * 200) * 0.2
            }
        case .line:
            duration = 0.4
            sample = { [self] _, t in 0.6 * (note(659.25, at: t, decay: 9) + note(880, at: t - 0.09, decay: 8)) }
        case .double:
            duration = 0.5
            sample = { [self] _, t in 0.5 * (note(523.25, at: t, decay: 9) + note(659.25, at: t - 0.08, decay: 9) + note(783.99, at: t - 0.16, decay: 8)) }
        case .triple:
            duration = 0.65
            sample = { [self] _, t in
                0.45 * (note(523.25, at: t, decay: 8) + note(659.25, at: t - 0.07, decay: 8)
                        + note(783.99, at: t - 0.14, decay: 8) + note(1046.5, at: t - 0.21, decay: 7))
            }
        case .crack:
            duration = 0.28
            var phase = 0.0
            sample = { [self] i, t in
                phase += 2 * .pi * 95 / sampleRate
                let saw = (phase / .pi).truncatingRemainder(dividingBy: 2) - 1
                return (noise(i) * exp(-t * 28) * 0.5 + saw * exp(-t * 11) * 0.3)
            }
        case .win:
            duration = 1.0
            sample = { [self] _, t in
                0.4 * (note(523.25, at: t, decay: 5) + note(659.25, at: t - 0.11, decay: 5)
                       + note(783.99, at: t - 0.22, decay: 5) + note(1046.5, at: t - 0.33, decay: 4))
            }
        case .lose:
            duration = 0.7
            sample = { [self] _, t in 0.6 * (note(392, at: t, decay: 5) + note(293.66, at: t - 0.18, decay: 5)) }
        case .tick:
            duration = 0.035
            sample = { [self] _, t in note(1500, at: t, decay: 130, volume: 0.25) }
        case .chest:
            duration = 0.9
            sample = { [self] _, t in
                0.35 * (note(659.25, at: t, decay: 5) + note(830.6, at: t - 0.06, decay: 5) + note(987.8, at: t - 0.12, decay: 5)
                        + note(1318.5, at: t - 0.18, decay: 4) + note(1661.2, at: t - 0.24, decay: 4))
            }
        case .star(let index):
            duration = 0.4
            let frequency = [783.99, 987.77, 1174.66][max(0, min(2, index))]
            sample = { [self] _, t in note(frequency, at: t, decay: 8, volume: 0.6) }
        }
        let frames = AVAudioFrameCount(duration * sampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let channel = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frames
        for i in 0..<Int(frames) {
            channel[i] = Float(max(-0.95, min(0.95, sample(i, Double(i) / sampleRate))))
        }
        return buffer
    }
}

/// Call sites use `Sound.play(.land)`, like `Haptics`.
@MainActor
enum Sound {
    static var enabled: Bool {
        get { SoundEngine.shared.enabled }
        set { SoundEngine.shared.enabled = newValue }
    }

    static func play(_ effect: SoundEffect) { SoundEngine.shared.play(effect) }
}
