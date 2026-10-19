# Tools

Every tool returns a JSON object rendered as MCP text content. Validation failures and
aria2 errors are returned as `isError: true` with a short message.

## `aria2_add_uri`

Queue one or more downloads.

| Field    | Type       | Required | Description                            |
| -------- | ---------- | -------- | -------------------------------------- |
| `uris`   | `string[]` | yes      | HTTP, HTTPS, FTP, SFTP or magnet URIs  |
| `dir`    | `string`   | no       | Absolute target directory              |
| `out`    | `string`   | no       | Output file name                       |
| `header` | `string[]` | no       | Extra HTTP headers, e.g. `Cookie: a=b` |

Calls `aria2.addUri` and returns `{ "gid": "...", "status": "queued" }`.

## `aria2_list`

List downloads.

| Field   | Type                                        | Required | Description          |
| ------- | ------------------------------------------- | -------- | -------------------- |
| `state` | `active` \| `waiting` \| `stopped` \| `all` | no       | Defaults to `active` |

`all` returns `{ active, waiting, stopped }` in a single call.

## `aria2_status`

| Field | Type     | Required | Description  |
| ----- | -------- | -------- | ------------ |
| `gid` | `string` | yes      | Download GID |

Calls `aria2.tellStatus` with a fixed set of keys covering progress, speed, connections,
error state, files and BitTorrent metadata.

## `aria2_pause` / `aria2_unpause`

| Field | Type     | Required | Description  |
| ----- | -------- | -------- | ------------ |
| `gid` | `string` | yes      | Download GID |

## `aria2_remove`

| Field   | Type      | Required | Description             |
| ------- | --------- | -------- | ----------------------- |
| `gid`   | `string`  | yes      | Download GID            |
| `force` | `boolean` | no       | Use `aria2.forceRemove` |

Always attempts `aria2.removeDownloadResult` afterwards and reports `resultPurged`, so a
stopped download can still be cleared.

## `aria2_global_stat`

No arguments. Calls `aria2.getGlobalStat`.

## `aria2_get_version`

No arguments. Calls `aria2.getVersion`.
