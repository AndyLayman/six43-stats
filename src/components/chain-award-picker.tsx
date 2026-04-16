"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { fullName } from "@/lib/player-name";
import type { Player, ChainAward } from "@/lib/scoring/types";
import { Trophy, Gym } from "iconoir-react";

interface ChainAwardPickerProps {
  players: Player[];
  sourceType: "game" | "practice";
  sourceId: string;
  date: string;
}

const AWARDS = [
  { type: "game_chain" as const, label: "Game Chain", Icon: Trophy },
  { type: "hard_worker" as const, label: "Hard Worker", Icon: Gym },
];

export function ChainAwardPicker({ players, sourceType, sourceId, date }: ChainAwardPickerProps) {
  const { activeTeam } = useAuth();
  const [selections, setSelections] = useState<Record<string, number | null>>({
    game_chain: null,
    hard_worker: null,
  });
  const [saved, setSaved] = useState<Record<string, boolean>>({ game_chain: false, hard_worker: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("chain_awards")
        .select("*")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId);

      if (data && data.length > 0) {
        const newSelections: Record<string, number | null> = { game_chain: null, hard_worker: null };
        const newSaved: Record<string, boolean> = { game_chain: false, hard_worker: false };
        for (const award of data as ChainAward[]) {
          newSelections[award.award_type] = award.player_id;
          newSaved[award.award_type] = true;
        }
        setSelections(newSelections);
        setSaved(newSaved);
      }
      setLoading(false);
    }
    load();
  }, [sourceType, sourceId]);

  async function handleSelect(awardType: string, playerId: number) {
    const current = selections[awardType];
    const newPlayerId = current === playerId ? null : playerId;

    setSelections({ ...selections, [awardType]: newPlayerId });

    // Delete existing award for this type/source
    await supabase
      .from("chain_awards")
      .delete()
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .eq("award_type", awardType);

    // Insert new if selected
    if (newPlayerId !== null) {
      await supabase.from("chain_awards").insert({
        team_id: activeTeam!.team_id,
        player_id: newPlayerId,
        award_type: awardType,
        source_type: sourceType,
        source_id: sourceId,
        date,
      });
      setSaved({ ...saved, [awardType]: true });
    } else {
      setSaved({ ...saved, [awardType]: false });
    }
  }

  if (loading) return null;

  return (
    <div className="space-y-4">
      {AWARDS.map((award) => (
        <div key={award.type}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
            <award.Icon width={16} height={16} />
            {award.label}
            {saved[award.type] && selections[award.type] && (
              <span className="ml-auto text-[10px] normal-case text-primary font-normal">
                Awarded to {(() => { const p = players.find((p) => p.id === selections[award.type]); return p ? fullName(p) : ""; })()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(award.type, p.id)}
                className={`h-10 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 select-none truncate px-1 ${
                  selections[award.type] === p.id
                    ? award.type === "game_chain"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-md"
                      : "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-md"
                    : "bg-muted/30 text-foreground border-border/50"
                }`}
              >
                #{p.number} {p.first_name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
