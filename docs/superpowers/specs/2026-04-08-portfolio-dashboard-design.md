# Portfolio Dashboard Design Spec

## Overview

天哥「百万之路」系列 YouTube 视频专用的投资组合仪表盘。主要用途是录屏展示给观众，视觉效果优先。部署到云端（Vercel），有固定网址。

## 使用场景

每周录制视频时，天哥上传 Fidelity 持仓 CSV 文件到 dashboard，屏幕录制展示给观众。

## 数据来源

- Fidelity 券商导出的 CSV 文件
- 浏览器端解析，不需要后端存储

### 上传逻辑

| 上传文件数 | 行为 |
|:---|:---|
| **1 个文件** | 当天持仓快照，显示净值和资产分配，不显示周对比涨跌 |
| **2 个文件** | 根据文件名中的日期自动判断新旧，展示周对比（净值变化、资产分配变化） |

文件名日期解析规则：Fidelity CSV 文件名通常包含日期信息（如 `Portfolio_Positions_Apr-05-2026.csv`），解析文件名中的日期来判断哪个是新文件、哪个是旧文件。

## 页面结构

单页面应用，三个区域从上到下排列：

### 1. 上传区 (Upload Zone)

- 拖拽或点击上传 1-2 个 CSV 文件
- 上传后自动解析，无需点击"提交"按钮
- 显示已上传文件名和检测到的日期
- 支持重新上传（替换当前数据）

### 2. 账户总览 (Portfolio Overview)

**单文件模式：**
- 当前净值（大字体）
- 百万目标进度条（$400,000 → $1,000,000）
- 进度百分比 + 距离目标还差多少

**双文件模式（增加以下内容）：**
- 本周涨跌金额（绿涨红跌）
- 本周涨跌百分比
- 上周净值（小字体参考）

### 3. 资产分配 (Asset Allocation)

**左侧 — 环形图 (Donut Chart)：**
- 显示当前各类别占比
- 类别：安全端 (Safe Side) / 现金 (Cash) / Wheel / LEAPS
- 悬停显示具体金额和百分比

**右侧 — 对比表格：**

| 类别 | 当前金额 | 当前占比 | 目标占比 | 偏差 |
|:---|:---|:---|:---|:---|
| 安全端 (Safe Side) | $xxx | xx% | 58% | +/-x% |
| └ QQQM | $xxx | | 30% of Safe | |
| └ VOO | $xxx | | 30% of Safe | |
| └ 个股 | $xxx | | 40% of Safe | |
| 现金 (Cash) | $xxx | xx% | 5% | +/-x% |
| Wheel | $xxx | xx% | 29.6% | +/-x% |
| LEAPS | $xxx | xx% | 7.4% | +/-x% |

- 偏差超过 ±3% 的行高亮标注（超配标红、欠配标黄）

**双文件模式额外展示：**
- 每个类别显示"上周 → 本周"的变化箭头

## 目标仓位计算规则

基于天哥的「TG Dynamic Composite Allocation」系统：

```
输入参数：
- age: 当前年龄（默认 38）
- has_income: 是否有收入（默认 true）

计算：
- safe_side_pct = age + 20           → 58%
- cash_pct = has_income ? 5 : 10     → 5%
- options_pct = 100 - safe_side_pct - cash_pct  → 37%
- wheel_pct = options_pct * 0.80     → 29.6%
- leaps_pct = options_pct * 0.20     → 7.4%

安全端内部：
- qqqm_pct = safe_side_pct * 0.30   → 17.4%
- voo_pct = safe_side_pct * 0.30    → 17.4%
- stocks_pct = safe_side_pct * 0.40 → 23.2%
- single_stock_max = safe_side_pct * 0.10 → 5.8%
```

上限规则：安全端最高 80%（60 岁后触碰上限）。

## Fidelity CSV 解析

需要从 CSV 中提取的字段：
- **Account Name/Number** — 识别账户
- **Symbol** — 股票/期权代码
- **Description** — 用于区分股票 vs 期权
- **Quantity** — 持仓数量
- **Current Value** — 当前市值
- **Type** — 用于分类到不同类别

### 分类逻辑

将每个持仓归类到四大类别之一：
- **安全端 (Safe Side):** QQQM, VOO, 以及其他长期持有的个股
- **现金 (Cash):** 现金余额（Fidelity CSV 中通常标记为 cash 或 money market）
- **Wheel:** 活跃的 Sell Put / Covered Call 仓位（通过 Description 中的 PUT/CALL 识别）+ 被 assign 后持有的正股
- **LEAPS:** 长期 Call 期权（DTE > 180 天的 Call）

注意：具体分类规则需要在实际查看 Fidelity CSV 格式后细化。第一版可以先做手动标签映射，后续优化自动识别。

## 视觉风格

- **深色主题** — 类似 Bloomberg Terminal / TradingView
- 背景色：深灰/近黑（如 #0a0a0f, #111827）
- 主色调：蓝/青色系
- 涨跌色：绿涨红跌
- 字体：等宽数字字体 + 无衬线标题
- 数字必须精确到小数点后两位（金额）和一位（百分比）
- 进度条和图表需要微动画（加载时渐入）

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 框架 | Next.js 14 (App Router) |
| 样式 | Tailwind CSS |
| 图表 | Recharts |
| CSV 解析 | Papa Parse |
| 部署 | Vercel |
| 语言 | TypeScript |

## 不在范围内

- 用户认证/登录
- 数据库/历史数据持久化
- 交易明细展示
- 权利金汇总/计分板/现金流瀑布
- 市场数据 API 接入
- 移动端适配（桌面录屏优先）
