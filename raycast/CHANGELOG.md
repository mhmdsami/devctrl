# Changelog

## 1.0.5 - 2026-09-16

Keeps the store in step with devctl 1.0.5: worktree ports are now pinned (no drift when new
worktrees appear), services can health-check for real readiness, orphaned services are adopted
back instead of blocking a start, and env templates gained `${dnsName}`/`${portlessUrl}`.

## 1.0.4 - 2026-09-15

Guard async callbacks so unloading the extension worker cannot surface Worker unloaded errors.

## 1.0.3 - 2026-09-10

Diagnose action for running and failed services; menubar shows only fully up stacks; steadier polling; config get/set.

## 1.0.2 - 2026-09-10

Menubar counts fully up stacks only.

## 1.0.1 - 2026-09-10

Set store author to sm-sami.

## 1.0.0 - 2026-09-10

Initial private release: menubar stack overview, manage/create/edit stacks, per-service actions, env switching, agent context export.
