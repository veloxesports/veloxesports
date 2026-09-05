type RuleTemplateGame = {
  name: string;
  slug: string;
};

type GameRuleProfile = {
  matchSettings: string[];
  fairPlay: string[];
};

const genericProfile: GameRuleProfile = {
  matchSettings: [
    "Use the game mode, platform, region, and lobby details published by the organizer in the tournament announcement.",
    "Only the published tournament format, bracket, scoring settings, and match settings apply. Any later change will be announced to every registered player.",
  ],
  fairPlay: [
    "Do not use exploits, unauthorized tools, account sharing, boosting, or any method that gives an unfair competitive advantage.",
  ],
};

const gameProfiles: Record<string, GameRuleProfile> = {
  valorant: {
    matchSettings: [
      "Matches are played in the organizer-provided Custom Game lobby on the published server and map/mode rotation. The lobby host's settings are binding.",
      "Players must use the registered Riot account. Team rosters must be submitted before the first match; substitutes require organizer approval.",
    ],
    fairPlay: [
      "Third-party cheats, macros, unauthorized overlays, account sharing, stream sniping, ghosting, and exploiting map or ability bugs are prohibited.",
    ],
  },
  fortnite: {
    matchSettings: [
      "Matches are played in the organizer-provided private/custom lobby using the published playlist, region, round count, and scoring rules.",
      "Players must use the registered Epic account. Placement and elimination scoring follows the published event settings.",
    ],
    fairPlay: [
      "Teaming outside an approved team mode, stream sniping, collusion, unauthorized macros, exploit abuse, and account sharing are prohibited.",
    ],
  },
  pubg: {
    matchSettings: [
      "Matches are played in the organizer-provided custom room with the published map rotation, perspective, squad size, and scoring configuration.",
      "Each participant must use the registered PUBG account. Team rosters lock when check-in closes unless the organizer approves a substitution.",
    ],
    fairPlay: [
      "Teaming outside an approved squad, collusion, stream sniping, unauthorized emulators or macros, exploit abuse, and account sharing are prohibited.",
    ],
  },
  chess: {
    matchSettings: [
      "Matches use the published time control, colour allocation, pairing method, and platform or private-room link. The organizer's pairing is binding.",
      "Players must use the registered chess account. Takebacks, external assistance, and unapproved rematches are not permitted.",
    ],
    fairPlay: [
      "Chess engines, opening databases during a live game, advice from another person, account sharing, deliberate stalling, and arranged results are prohibited.",
    ],
  },
  "fall-guys": {
    matchSettings: [
      "Matches use the organizer-provided custom show, round order, lobby code, and qualifying rules. The published scoring and tie-breaker rules apply.",
      "Players must use the registered Epic account and join the assigned lobby before the scheduled round begins.",
    ],
    fairPlay: [
      "Exploit abuse, intentional teaming in solo rounds, stream sniping, account sharing, and any manipulation of a custom-show result are prohibited.",
    ],
  },
};

export function getTournamentRulesTemplate(game: RuleTemplateGame) {
  const profile = gameProfiles[game.slug.toLowerCase()] ?? genericProfile;

  return `${game.name.toUpperCase()} — KHEMORA TOURNAMENT RULES

1. Tournament format and match settings
• The tournament follows the format, participant limit, schedule, region, and game mode shown in the published Khemora event page. The published bracket or scoring table is binding.
• ${profile.matchSettings[0]}
• ${profile.matchSettings[1]}

2. Player and team eligibility
• Every participant must have an active Khemora account, complete registration, and meet any event-specific age, region, platform, or rank requirements stated on the event page.
• A player may enter only once. In team events, each player may represent one registered team only. Team captains are responsible for their roster and communications.

3. Scheduling and check-in
• Players and teams must check in through Khemora during the published check-in window. Unchecked-in entries may be replaced or forfeited.
• Participants must be ready at the assigned match time. Match times are East Africa Time unless the event page states otherwise. Players must monitor Khemora and Telegram for schedule updates.

4. Results, reporting, and evidence
• The winning player or team must report the result promptly through Khemora. Both sides must keep screenshots, match summaries, or other requested evidence until the result is finalized.
• Reported scores must reflect the actual match. False, incomplete, or manipulated evidence may lead to a forfeit, suspension, or ban.

5. Disconnections and technical issues
• Players are responsible for a stable internet connection, working game client, and eligible account. A disconnect normally does not require a replay.
• A replay, pause, remake, or reschedule is allowed only when the organizer confirms a platform-wide issue, a verified server failure, or another exceptional circumstance before the result is finalized.

6. Fair play and prohibited behavior
• ${profile.fairPlay[0]}
• Harassment, hate speech, threats, doxxing, impersonation, bribery, match fixing, deliberate delays, and abuse of Khemora staff or opponents are prohibited.

7. Disputes and forfeits
• A dispute must be submitted through the Khemora match flow with clear evidence as soon as possible and before the published dispute deadline. Do not continue to argue in public channels.
• Failure to check in, join a lobby, provide required proof, or respond to an organizer within the stated window may result in a forfeit. Repeated no-shows can lead to account restrictions.

8. Prizes and payments
• Prize amounts, eligibility, and distribution are those shown on the published event page. Prizes are awarded only after results, disputes, and fair-play checks are complete.
• Paid entries are collected only through Telegram Stars. Refunds, when applicable, follow Khemora's cancellation and payment policy; no off-platform payment request is valid.

9. Organizer decisions
• Khemora organizers may correct clear administrative errors, adjust a schedule for technical or safety reasons, disqualify rule violations, and make the final decision on evidence and disputes.
• By registering, each participant agrees to these rules and any clearly published event-specific additions. These rules may be edited by the organizer before the tournament is published.`;
}
