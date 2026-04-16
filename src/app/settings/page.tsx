"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLeagueConfig, updateLeagueConfig, type LeagueConfig } from "@/lib/league-config";

export default function SettingsPage() {
  const [config, setConfig] = useState<LeagueConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const c = await getLeagueConfig();
    setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    const ok = await updateLeagueConfig(config);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const update = <K extends keyof LeagueConfig>(key: K, value: LeagueConfig[K]) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  if (loading || !config) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Game Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="maxInnings">Innings per game</Label>
            <Input
              id="maxInnings"
              type="number"
              min={1}
              max={9}
              value={config.maxInnings}
              onChange={(e) => update("maxInnings", parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="battingOrderSize">Batting order size</Label>
            <Input
              id="battingOrderSize"
              type="number"
              min={1}
              max={20}
              value={config.battingOrderSize}
              onChange={(e) => update("battingOrderSize", parseInt(e.target.value) || 9)}
            />
          </div>

          <Toggle
            label="Allow re-entry"
            description="Substituted players can return to the game"
            checked={config.allowReEntry}
            onChange={(v) => update("allowReEntry", v)}
          />

          <Toggle
            label="Continuous batting order"
            description="Entire roster bats in order"
            checked={config.continuousBattingOrder}
            onChange={(v) => update("continuousBattingOrder", v)}
          />

          <Toggle
            label="Extra hitter (EH)"
            description="Allow an additional batting position beyond 9"
            checked={config.extraHitterAllowed}
            onChange={(v) => update("extraHitterAllowed", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mercy Rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Enabled"
            checked={config.mercyRuleEnabled}
            onChange={(v) => update("mercyRuleEnabled", v)}
          />

          {config.mercyRuleEnabled && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="mercyDiff">Run difference</Label>
                <Input
                  id="mercyDiff"
                  type="number"
                  min={1}
                  value={config.mercyRuleRunDifference}
                  onChange={(e) => update("mercyRuleRunDifference", parseInt(e.target.value) || 10)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mercyAfter">Applies after inning</Label>
                <Input
                  id="mercyAfter"
                  type="number"
                  min={1}
                  max={config.maxInnings}
                  value={config.mercyRuleAfterInning}
                  onChange={(e) => update("mercyRuleAfterInning", parseInt(e.target.value) || 4)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pitch Counts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Track pitch counts"
            checked={config.pitchCountEnabled}
            onChange={(v) => update("pitchCountEnabled", v)}
          />

          {config.pitchCountEnabled && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="maxPerGame">Max per game</Label>
                <Input
                  id="maxPerGame"
                  type="number"
                  min={1}
                  value={config.pitchCountMaxPerGame}
                  onChange={(e) => update("pitchCountMaxPerGame", parseInt(e.target.value) || 85)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxPerWeek">Max per week</Label>
                <Input
                  id="maxPerWeek"
                  type="number"
                  min={1}
                  value={config.pitchCountMaxPerWeek}
                  onChange={(e) => update("pitchCountMaxPerWeek", parseInt(e.target.value) || 175)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </Button>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center justify-between w-full text-left"
      onClick={() => onChange(!checked)}
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </div>
    </button>
  );
}
