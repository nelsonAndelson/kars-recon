"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActor } from "./shop-shell";
import { Button } from "./ui/button";
import { ActionDialog } from "./action-dialog";
import { saveTeam } from "@/app/shop-actions";
import type { Tables } from "@/types/database";
const labels = {
  owner: "Admin",
  tech: "Technician",
  advisor: "Advisor",
  viewer: "View only",
};
export function TeamWorkspace({
  profiles,
}: {
  profiles: Tables<"profiles">[];
}) {
  const { actor } = useActor(),
    router = useRouter();
  const [editing, setEditing] = useState<Tables<"profiles"> | null>(null),
    [original, setOriginal] = useState<Tables<"profiles"> | null>(null),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const admin = profiles.some(
    (p) => p.id === actor && p.active && p.role === "owner",
  );
  function edit(person: Tables<"profiles"> | null) {
    setError("");
    setOriginal(person);
    setEditing(
      person ?? {
        id: crypto.randomUUID(),
        full_name: "",
        role: "tech",
        active: true,
      },
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Team</h1>
          <p>Names, responsibilities and active team members.</p>
        </div>
        <Button disabled={!admin} onClick={() => edit(null)}>
          Add team member
        </Button>
      </div>
      {!admin && (
        <p className="notice">
          Choose an admin under Working as to manage the team.
        </p>
      )}
      <div className="team-grid">
        {profiles.map((p) => (
          <article className="team-card" key={p.id}>
            <h2>{p.full_name}</h2>
            <p>
              {labels[p.role]} ·{" "}
              {p.active ? "Active" : "Removed from active team"}
            </p>
            <Button variant="outline" disabled={!admin} onClick={() => edit(p)}>
              Edit {p.full_name}
            </Button>
          </article>
        ))}
      </div>
      <p className="notice">
        Anyone can switch between Admin and Technician views. Roles stay the
        same. Removing a person deactivates them and preserves their history;
        they can be restored here.
      </p>
      {editing && (
        <ActionDialog
          title={original ? "Edit team member" : "Add team member"}
          onClose={() => {
            if (!pending) setEditing(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              start(async () => {
                try {
                  const result = await saveTeam({
                    ...editing,
                    actor_id: actor,
                    expected: original,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setEditing(null);
                  router.refresh();
                } catch {
                  setError("Could not save. Your entries are still here.");
                }
              });
            }}
          >
            <fieldset disabled={pending} className="plain-fieldset">
              <label className="field">
                Full name
                <input
                  required
                  maxLength={80}
                  value={editing.full_name}
                  onChange={(e) =>
                    setEditing({ ...editing, full_name: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Role
                <select
                  value={editing.role}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      role: e.target.value as Tables<"profiles">["role"],
                    })
                  }
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {original && (
                <label className="team-active">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) =>
                      setEditing({ ...editing, active: e.target.checked })
                    }
                  />
                  Active team member
                </label>
              )}
              {original && (
                <p className="form-hint">
                  Uncheck to remove from the active team. Reassign open jobs
                  first. Past work stays attributed to this person.
                </p>
              )}
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={pending} type="submit">
              {pending
                ? "Saving…"
                : original && !editing.active
                  ? "Remove from active team"
                  : "Save team member"}
            </Button>
          </form>
        </ActionDialog>
      )}
    </>
  );
}
