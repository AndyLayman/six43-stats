"use client";

import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import { useEffect, useCallback, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { List, NumberedListLeft, Quote, Link, MediaImage, Play } from "iconoir-react";

interface MentionItem {
  id: string;
  label: string;
}

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autofocus?: boolean;
  mentions?: MentionItem[];
}

// Mention suggestion list component
const MentionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: MentionItem[]; command: (item: MentionItem) => void }
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-border/50 bg-card shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto">
      {items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => command(item)}
          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
            idx === selectedIndex
              ? "bg-primary/15 text-primary font-bold"
              : "text-foreground hover:bg-muted/50"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";

function createMentionSuggestion(mentionItems: MentionItem[]) {
  return {
    items: ({ query }: { query: string }) => {
      return mentionItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);
    },
    render: () => {
      let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }> | null = null;
      let popup: HTMLDivElement | null = null;

      return {
        onStart: (props: Record<string, unknown>) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor as any,
          });

          popup = document.createElement("div");
          popup.style.position = "absolute";
          popup.style.zIndex = "50";
          document.body.appendChild(popup);

          const domRect = props.clientRect as (() => DOMRect | null);
          const rect = domRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }

          if (component.element && popup) {
            popup.appendChild(component.element);
          }
        },
        onUpdate: (props: Record<string, unknown>) => {
          component?.updateProps(props);
          const domRect = props.clientRect as (() => DOMRect | null);
          const rect = domRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            popup?.remove();
            component?.destroy();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
        },
      };
    },
  };
}

export function RichEditor({ content, onChange, placeholder = "Start writing...", autofocus = false, mentions = [] }: RichEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const mentionsRef = useRef(mentions);
  mentionsRef.current = mentions;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      LinkExt.configure({
        openOnClick: true,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      ImageExt.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full my-2" },
      }),
      Youtube.configure({
        HTMLAttributes: { class: "rounded-lg my-2" },
        width: 480,
        height: 270,
      }),
      ...(mentions.length > 0
        ? [
            Mention.configure({
              HTMLAttributes: {
                class: "mention",
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              suggestion: createMentionSuggestion(mentions) as any,
            }),
          ]
        : []),
    ],
    content,
    autofocus,
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2.5",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]);

  const addImage = useCallback(() => {
    const url = prompt("Image URL:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addVideo = useCallback(() => {
    if (videoUrl && editor) {
      editor.commands.setYoutubeVideo({ src: videoUrl });
      setVideoUrl("");
      setShowVideoInput(false);
      editor.commands.focus();
    }
  }, [editor, videoUrl]);

  const addLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
  }, [editor, linkUrl]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border-2 border-border/50 bg-muted/30 overflow-hidden transition-colors focus-within:border-primary/50">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-border/30 bg-muted/20">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <span className="underline">U</span>
        </ToolBtn>
        <div className="w-px bg-border/30 mx-0.5" />
        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading"
        >
          H2
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subheading"
        >
          H3
        </ToolBtn>
        <div className="w-px bg-border/30 mx-0.5" />
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List width={14} height={14} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <NumberedListLeft width={14} height={14} />
        </ToolBtn>
        <div className="w-px bg-border/30 mx-0.5" />
        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <Quote width={14} height={14} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(!showLinkInput);
              setShowVideoInput(false);
            }
          }}
          title="Link"
        >
          <Link width={14} height={14} />
        </ToolBtn>
        <ToolBtn
          active={false}
          onClick={addImage}
          title="Image"
        >
          <MediaImage width={14} height={14} />
        </ToolBtn>
        <ToolBtn
          active={false}
          onClick={() => { setShowVideoInput(!showVideoInput); setShowLinkInput(false); }}
          title="YouTube video"
        >
          <Play width={14} height={14} />
        </ToolBtn>
        {mentions.length > 0 && (
          <>
            <div className="w-px bg-border/30 mx-0.5" />
            <ToolBtn
              active={false}
              onClick={() => editor.chain().focus().insertContent("@").run()}
              title="Tag a player"
            >
              @
            </ToolBtn>
          </>
        )}
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div className="flex gap-2 p-2 border-b border-border/30 bg-muted/10">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 h-8 rounded-lg bg-muted/30 border border-border/50 px-2 text-sm focus:outline-none focus:border-primary/50"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <button onClick={addLink} className="h-8 px-3 rounded-lg bg-primary/20 text-primary text-xs font-bold">Add</button>
          <button onClick={() => setShowLinkInput(false)} className="h-8 px-2 text-xs text-muted-foreground">Cancel</button>
        </div>
      )}

      {/* Video input */}
      {showVideoInput && (
        <div className="flex gap-2 p-2 border-b border-border/30 bg-muted/10">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube URL..."
            className="flex-1 h-8 rounded-lg bg-muted/30 border border-border/50 px-2 text-sm focus:outline-none focus:border-primary/50"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && addVideo()}
          />
          <button onClick={addVideo} className="h-8 px-3 rounded-lg bg-primary/20 text-primary text-xs font-bold">Embed</button>
          <button onClick={() => setShowVideoInput(false)} className="h-8 px-2 text-xs text-muted-foreground">Cancel</button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all active:scale-90 select-none ${
        active
          ? "bg-primary/20 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
