import React, { useState } from "react";
import { Sparkles, BookOpen, Plus, Trash2, X } from "lucide-react";
import type { MemoryFact, MemoryStory } from "../../api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  useCreateFact,
  useDeleteFact,
  useCreateStory,
  useDeleteStory,
} from "../../hooks/useAdminQueries";

interface ChannelMemoryTabProps {
  chatId: string;
  facts: MemoryFact[];
  stories: MemoryStory[];
}

export function ChannelMemoryTab({
  chatId,
  facts,
  stories,
}: ChannelMemoryTabProps) {
  const createFactMutation = useCreateFact(chatId);
  const deleteFactMutation = useDeleteFact(chatId);
  const createStoryMutation = useCreateStory(chatId);
  const deleteStoryMutation = useDeleteStory(chatId);

  // Forms state
  const [showFactForm, setShowFactForm] = useState(false);
  const [factForm, setFactForm] = useState({ subject: "", fact: "" });

  const [showStoryForm, setShowStoryForm] = useState(false);
  const [storyForm, setStoryForm] = useState({
    title: "",
    story: "",
    people: "",
    happenedOn: "",
  });

  // Delete dialogs
  const [factToDelete, setFactToDelete] = useState<number | null>(null);
  const [storyToDelete, setStoryToDelete] = useState<number | null>(null);

  const handleFactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factForm.subject.trim() || !factForm.fact.trim()) return;
    try {
      await createFactMutation.mutateAsync(factForm);
      setShowFactForm(false);
      setFactForm({ subject: "", fact: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save fact");
    }
  };

  const handleStorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyForm.title.trim() || !storyForm.story.trim()) return;
    try {
      await createStoryMutation.mutateAsync(storyForm);
      setShowStoryForm(false);
      setStoryForm({ title: "", story: "", people: "", happenedOn: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save story");
    }
  };

  const handleDeleteFact = async () => {
    if (!factToDelete) return;
    try {
      await deleteFactMutation.mutateAsync(factToDelete);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete fact");
    } finally {
      setFactToDelete(null);
    }
  };

  const handleDeleteStory = async () => {
    if (!storyToDelete) return;
    try {
      await deleteStoryMutation.mutateAsync(storyToDelete);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete story");
    } finally {
      setStoryToDelete(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Facts Section */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Remembered Facts</h3>
            <span className="text-xs text-slate-400">({facts.length})</span>
          </div>
          <Button
            size="sm"
            variant={showFactForm ? "secondary" : "default"}
            onClick={() => setShowFactForm(!showFactForm)}
          >
            {showFactForm ? <X size={14} /> : <Plus size={14} />}
            <span>{showFactForm ? "Close Form" : "Add Fact"}</span>
          </Button>
        </div>

        {showFactForm && (
          <form onSubmit={handleFactSubmit} className="glass-panel p-5 mb-6 border border-indigo-500/40">
            <div className="grid grid-cols-[1fr_2fr] gap-3.5 mb-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Subject *</label>
                <Input
                  required
                  placeholder="e.g. Mom, Dad, Alex..."
                  value={factForm.subject}
                  onChange={(e) => setFactForm({ ...factForm, subject: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fact *</label>
                <Input
                  required
                  placeholder="e.g. Likes vegetarian food on 15th, allergic to shrimp..."
                  value={factForm.fact}
                  onChange={(e) => setFactForm({ ...factForm, fact: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowFactForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={createFactMutation.isPending}
              >
                Save Fact
              </Button>
            </div>
          </form>
        )}

        {facts.length === 0 ? (
          <div className="text-slate-400 text-sm">No facts recorded yet.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
            {facts.map((f) => (
              <div key={f.id} className="glass-panel p-3.5 px-4 flex justify-between items-start">
                <div>
                  <span className="font-bold text-indigo-400 text-sm">{f.subject}:</span>
                  <p className="text-sm mt-1 text-slate-200">{f.fact}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFactToDelete(f.id)}
                  className="text-slate-400 hover:text-rose-400"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stories Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Memory Book (Stories)</h3>
            <span className="text-xs text-slate-400">({stories.length})</span>
          </div>
          <Button
            size="sm"
            variant={showStoryForm ? "secondary" : "default"}
            onClick={() => setShowStoryForm(!showStoryForm)}
          >
            {showStoryForm ? <X size={14} /> : <Plus size={14} />}
            <span>{showStoryForm ? "Close Form" : "Add Story"}</span>
          </Button>
        </div>

        {showStoryForm && (
          <form onSubmit={handleStorySubmit} className="glass-panel p-5 mb-6 border border-emerald-500/40">
            <div className="grid grid-cols-[2fr_1fr] gap-3.5 mb-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Story Title *</label>
                <Input
                  required
                  placeholder="e.g. Summer vacation trip to Da Nang 2024..."
                  value={storyForm.title}
                  onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">People Involved</label>
                <Input
                  placeholder="Dad, Mom, Alex..."
                  value={storyForm.people}
                  onChange={(e) => setStoryForm({ ...storyForm, people: e.target.value })}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-1">Story Content *</label>
              <Textarea
                required
                rows={3}
                placeholder="Recount the memorable event or story..."
                value={storyForm.story}
                onChange={(e) => setStoryForm({ ...storyForm, story: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowStoryForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={createStoryMutation.isPending}
              >
                Save Story
              </Button>
            </div>
          </form>
        )}

        {stories.length === 0 ? (
          <div className="text-slate-400 text-sm">No stories in the memory book yet.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {stories.map((s) => (
              <div key={s.id} className="glass-panel p-5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-base text-emerald-400">{s.title}</h4>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setStoryToDelete(s.id)}
                    className="text-slate-400 hover:text-rose-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{s.story}</p>
                {s.people && (
                  <div className="text-xs text-slate-400 mt-2">
                    👥 People: {s.people}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={factToDelete !== null}
        onOpenChange={(open) => !open && setFactToDelete(null)}
        title="Delete Remembered Fact"
        description="Are you sure you want to delete this fact from channel memory?"
        confirmText="Delete Fact"
        variant="destructive"
        loading={deleteFactMutation.isPending}
        onConfirm={handleDeleteFact}
      />

      <ConfirmDialog
        open={storyToDelete !== null}
        onOpenChange={(open) => !open && setStoryToDelete(null)}
        title="Delete Memory Story"
        description="Are you sure you want to delete this story from the memory book?"
        confirmText="Delete Story"
        variant="destructive"
        loading={deleteStoryMutation.isPending}
        onConfirm={handleDeleteStory}
      />
    </div>
  );
}
