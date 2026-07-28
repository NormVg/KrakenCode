import os
import glob
import re

handle_snippet = """
    <!-- Top Handles -->
    <Handle type="source" :position="Position.Top" id="top-s" class="arch-handle" />
    <Handle type="target" :position="Position.Top" id="top-t" class="arch-handle target-handle" />
    <!-- Bottom Handles -->
    <Handle type="source" :position="Position.Bottom" id="bottom-s" class="arch-handle" />
    <Handle type="target" :position="Position.Bottom" id="bottom-t" class="arch-handle target-handle" />
    <!-- Right Handles -->
    <Handle type="source" :position="Position.Right" id="right-s" class="arch-handle arch-handle-right" />
    <Handle type="target" :position="Position.Right" id="right-t" class="arch-handle arch-handle-right target-handle" />
    <!-- Left Handles -->
    <Handle type="source" :position="Position.Left" id="left-s" class="arch-handle arch-handle-left" />
    <Handle type="target" :position="Position.Left" id="left-t" class="arch-handle arch-handle-left target-handle" />
"""

css_patch = """
:deep(.arch-handle) {
  width: 8px;
  height: 8px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 0.15s ease;
}

:deep(.arch-handle.target-handle) {
  border: none;
  background: transparent;
  pointer-events: none; /* Let source handle take the drag events */
}

:deep(.arch-handle:hover) {
  background: #AA205A;
}
"""

node_dir = "src/renderer/src/components/architecture/nodes"
for file_path in glob.glob(f"{node_dir}/*.vue"):
    with open(file_path, "r") as f:
        content = f.read()

    # Remove all existing <Handle ... /> tags
    content = re.sub(r'<Handle[^>]+/>\n?', '', content)

    # Insert the new handles just before the closing </div> of the node
    # Usually it's </template> right after the closing </div>
    # Let's find the last </div> before </template>
    template_end = content.rfind("</template>")
    if template_end != -1:
        last_div = content.rfind("</div>", 0, template_end)
        if last_div != -1:
            content = content[:last_div] + handle_snippet + content[last_div:]

    # Patch CSS if necessary
    if ":deep(.arch-handle)" in content:
        # replace the whole block
        content = re.sub(r':deep\(\.arch-handle\)\s*\{[^}]+\}', '', content)
        content = re.sub(r':deep\(\.arch-handle:hover\)\s*\{[^}]+\}', '', content)
        content = content.replace("</style>", css_patch + "</style>")

    with open(file_path, "w") as f:
        f.write(content)
print("Nodes patched!")
