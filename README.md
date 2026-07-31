# Focus Space

一个本地优先的沉浸式番茄钟。它支持专注、短休息和长休息模式，使用 IndexedDB 保存设置与专注记录。

## 启动

```bash
npm install
npm run dev
```

## 验证

```bash
npm test -- --run
npm run build
```

## 技术栈

- React + TypeScript + Vite
- Zustand 管理计时状态
- IndexedDB（通过 `idb`）保存设置和会话
