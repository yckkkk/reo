# 参考与复用记录

## Context7

- shadcn/ui：source-owned 模式。组件源码进入 `components/ui/` 后由项目拥有并按设计系统定制；当前 slice 只新增真实 consumer 需要的 primitive，不创建无 invariant wrapper。
- shadcn Drawer：当前已基于 Vaul 工作，本 slice 继续复用 `RecordAudioDrawer`，不改 overlay mechanics。
- Radix primitives：可访问名称仍由应用负责；Label/Form/Dialog 等 primitive 可通过 `asChild` 组合，但本 slice 的 textarea label 已可用现有 `Label` primitive 表达。

## ElevenLabs UI

- Audio Player：官方文档把 audio player 拆为 Provider、Button、Progress、Time、Duration、Speed 等 source-owned building blocks，并说明底层使用 HTML5 audio。Reo 当前只有单条 finalized recording playback，没有 playlist、speed 或 global provider consumer，因此裁剪保留 HTML5 audio underlay、Reo play/pause control、Radix Slider playback position、time labels、本地 audio surface 与 command 组合。
- Transcript Viewer：官方文档面向 alignment + word-level synced highlighting。Reo 当前没有 alignment/STT foundation，因此不引入 shared synced words 或 audio-coupled transcript runtime；只在 recording feature-local editor 中提供有界 transcript draft preview。

## 参考图

- 参考图约束录音 drawer、workspace shell、sidebar 和主面板层级；本 slice 不重做 shell，只确保 drawer 编辑态不再是简陋 textarea 罗列。
- Transcript/Reflections 当前属于录音编辑态高保真范围；其它 future command 不显示为 runtime action。

## 复用决策

- `audio-player.tsx`：采用 ElevenLabs Audio Player 的 source-owned building block 思路，拒绝直接引入完整 provider/speed/global playlist，因为当前没有多 track 或 speed consumer；保留 HTML5 audio 基础、Radix Slider progress、Reo Button 和 Reo token。
- `TranscriptReflectionsEditor.tsx`：采用 ElevenLabs Transcript Viewer 的 transcript surface 职责，但保持 feature-local；拒绝 word-level alignment runtime，因为当前没有真实 alignment 数据，伪造会误导产品语义。
- `RecordingPlayback.tsx` / `TranscriptReflectionsEditor.tsx`：feature-local 组合，不进入 design-system primitive；它们只表达 recording drawer 的业务层级。
