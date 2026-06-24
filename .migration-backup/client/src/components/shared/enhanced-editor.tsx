import React from "react";
import WysiwygEditor from "./wysiwyg-editor-direct";
import { EditorContextData } from "@/types/editor";

// Enhanced editor component that now uses the new direct WYSIWYG editor
// This wrapper maintains backward compatibility for any components that depend on EnhancedEditor
export default function EnhancedEditor({ 
  editorContent, 
  setEditorContent,
  editorContext
}: { 
  editorContent: string; 
  setEditorContent: (content: string) => void;
  editorContext?: EditorContextData;
}) {
  return (
    <WysiwygEditor 
      editorContent={editorContent}
      setEditorContent={setEditorContent}
      editorContext={editorContext}
    />
  );
}