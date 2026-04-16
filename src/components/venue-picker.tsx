"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import type { Venue } from "@/lib/scoring/types";
import { EditPencil, Trash } from "iconoir-react";

interface VenuePickerProps {
  venue: string;
  venueAddress: string;
  onVenueChange: (venue: string) => void;
  onAddressChange: (address: string) => void;
}

export function VenuePicker({ venue, venueAddress, onVenueChange, onAddressChange }: VenuePickerProps) {
  const { activeTeam } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTeam) loadVenues();
  }, [activeTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVenues() {
    if (!activeTeam) return;
    const { data } = await supabase.from("venues").select("*").eq("team_id", activeTeam.team_id).order("name");
    setVenues(data ?? []);
  }

  function selectVenue(v: Venue) {
    onVenueChange(v.name);
    onAddressChange(v.address);
  }

  function startAdd() {
    setEditId(null);
    setEditName("");
    setEditAddress("");
    setShowManage(true);
  }

  function startEdit(v: Venue) {
    setEditId(v.id);
    setEditName(v.name);
    setEditAddress(v.address);
    setShowManage(true);
  }

  async function handleSave() {
    if (!editName.trim()) return;
    setSaving(true);
    if (editId) {
      await supabase.from("venues").update({ name: editName.trim(), address: editAddress.trim() }).eq("id", editId);
    } else {
      await supabase.from("venues").insert({ team_id: activeTeam!.team_id, name: editName.trim(), address: editAddress.trim() });
    }
    setSaving(false);
    setEditId(null);
    setEditName("");
    setEditAddress("");
    setShowManage(false);
    await loadVenues();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this venue?")) return;
    await supabase.from("venues").delete().eq("id", id);
    setVenues(venues.filter((v) => v.id !== id));
  }

  return (
    <div className="space-y-2">
      {/* Quick-select chips + manage button */}
      <div className="flex gap-2 flex-wrap items-center">
        {venues.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => selectVenue(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 select-none ${
              venue === v.name
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-muted/30 text-muted-foreground border-border/50"
            }`}
          >
            {v.name}
          </button>
        ))}
        <button
          type="button"
          onClick={startAdd}
          className="px-2.5 py-1.5 rounded-full text-xs font-bold border-2 border-dashed border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all active:scale-95"
          title="Add venue"
        >
          + New
        </button>
      </div>

      {/* Inline venue name + address fields */}
      <div className="space-y-2">
        <Input
          value={venue}
          onChange={(e) => onVenueChange(e.target.value)}
          placeholder="Field name"
          className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
        />
        <div className="relative z-20">
          <AddressAutocomplete
            value={venueAddress}
            onChange={onAddressChange}
            placeholder="Address"
            className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Manage venues modal */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="max-w-sm [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Venue" : "New Venue"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-hidden">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Poway Sportsplex Field 3"
                className="h-11 text-base bg-input/50 border-border/50 focus:border-primary/50 min-w-0 w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Address</label>
              <AddressAutocomplete
                value={editAddress}
                onChange={setEditAddress}
                placeholder="123 Main St, City, State ZIP"
                className="h-11 text-base bg-input/50 border-border/50 focus:border-primary/50 min-w-0 w-full"
              />
            </div>
            <div className="space-y-2">
              <Button
                className="w-full h-11 text-sm font-bold glow-primary"
                onClick={handleSave}
                disabled={saving || !editName.trim()}
              >
                {saving ? "Saving..." : editId ? "Update" : "Save Venue"}
              </Button>
              <Button variant="outline" className="w-full h-10 text-sm" onClick={() => setShowManage(false)}>
                Cancel
              </Button>
            </div>

            {/* Existing venues list for editing */}
            {venues.length > 0 && !editId && (
              <div className="border-t border-border/30 pt-3 mt-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Saved Venues</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {venues.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 group">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{v.name}</div>
                        {v.address && <div className="text-xs text-muted-foreground truncate">{v.address}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary transition-all shrink-0"
                      >
                        <EditPencil width={12} height={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-all shrink-0"
                      >
                        <Trash width={12} height={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
