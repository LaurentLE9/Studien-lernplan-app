# Claude Code Skill Adapter

Claude Code entdeckt Projekt-Skills unter `.claude/skills/`. Die fachliche Quelle dieses Repositories liegt providerneutral unter `.agents/skills/`.

Die Dateien in diesem Verzeichnis sind deshalb nur dünne Discovery-Adapter. Sie enthalten keine eigene Workflow-Logik und verweisen jeweils auf den kanonischen Skill.

**Regel:** Änderungen am Workflow immer zuerst in `.agents/skills/<name>/SKILL.md` vornehmen. Adapter nur ändern, wenn sich Name, Beschreibung oder Pfad ändert.