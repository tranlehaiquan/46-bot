import React, { useState } from "react";
import { Sparkles, BookOpen, Plus, Trash2 } from "lucide-react";
import type { MemoryFact, MemoryStory } from "../../api";

interface ChannelMemoryTabProps {
  facts: MemoryFact[];
  stories: MemoryStory[];
  onCreateFact: (subject: string, fact: string) => Promise<void>;
  onDeleteFact: (id: number) => Promise<void>;
  onCreateStory: (story: {
    title: string;
    story: string;
    people?: string;
    happenedOn?: string;
  }) => Promise<void>;
  onDeleteStory: (id: number) => Promise<void>;
}

export function ChannelMemoryTab({
  facts,
  stories,
  onCreateFact,
  onDeleteFact,
  onCreateStory,
  onDeleteStory,
}: ChannelMemoryTabProps) {
  // Facts form state
  const [showFactForm, setShowFactForm] = useState(false);
  const [factForm, setFactForm] = useState({ subject: "", fact: "" });

  // Stories form state
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [storyForm, setStoryForm] = useState({
    title: "",
    story: "",
    people: "",
    happenedOn: "",
  });

  const handleFactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateFact(factForm.subject, factForm.fact);
    setShowFactForm(false);
    setFactForm({ subject: "", fact: "" });
  };

  const handleStorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateStory(storyForm);
    setShowStoryForm(false);
    setStoryForm({ title: "", story: "", people: "", happenedOn: "" });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Facts Section */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Remembered Facts</h3>
          </div>
          <button
            onClick={() => setShowFactForm(!showFactForm)}
            className="btn btn-primary text-xs px-3.5 py-2"
          >
            <Plus size={14} />
            <span>{showFactForm ? "Close Form" : "Add Fact"}</span>
          </button>
        </div>

        {showFactForm && (
          <form onSubmit={handleFactSubmit} className="glass-panel p-5 mb-6">
            <div className="grid grid-cols-[1fr_2fr] gap-3.5 mb-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mom, Dad, Alex..."
                  value={factForm.subject}
                  onChange={(e) => setFactForm({ ...factForm, subject: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fact *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Likes vegetarian food on 15th, allergic to shrimp..."
                  value={factForm.fact}
                  onChange={(e) => setFactForm({ ...factForm, fact: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
                Save Fact
              </button>
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
                <button
                  onClick={() => onDeleteFact(f.id)}
                  className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
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
          </div>
          <button
            onClick={() => setShowStoryForm(!showStoryForm)}
            className="btn btn-primary text-xs px-3.5 py-2"
          >
            <Plus size={14} />
            <span>{showStoryForm ? "Close Form" : "Add Story"}</span>
          </button>
        </div>

        {showStoryForm && (
          <form onSubmit={handleStorySubmit} className="glass-panel p-5 mb-6">
            <div className="grid grid-cols-[2fr_1fr] gap-3.5 mb-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Story Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer vacation trip to Da Nang 2024..."
                  value={storyForm.title}
                  onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">People Involved</label>
                <input
                  type="text"
                  placeholder="Dad, Mom, Alex..."
                  value={storyForm.people}
                  onChange={(e) => setStoryForm({ ...storyForm, people: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-1">Story Content *</label>
              <textarea
                required
                rows={3}
                placeholder="Recount the memorable event or story..."
                value={storyForm.story}
                onChange={(e) => setStoryForm({ ...storyForm, story: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
                Save Story
              </button>
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
                  <button
                    onClick={() => onDeleteStory(s.id)}
                    className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
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
    </div>
  );
}
