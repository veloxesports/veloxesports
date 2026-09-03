"use client";

import { TournamentModal, type Game, type Tournament } from "./TournamentModal";

export { TournamentModal };
export type { Game, Tournament };

export function TournamentEditor({
  tournament,
  games,
  onClose,
  onSuccess,
}: {
  tournament: Tournament;
  games: Game[];
  onClose: () => void;
  onSuccess?: (message: string) => void;
}) {
  return (
    <TournamentModal
      isOpen={true}
      mode="edit"
      tournament={tournament}
      games={games}
      onClose={onClose}
      onSuccess={onSuccess ?? (() => onClose())}
    />
  );
}
