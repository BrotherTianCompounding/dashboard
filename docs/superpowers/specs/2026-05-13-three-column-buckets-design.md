# 三列横排仓位看板 — 设计文档

**日期**: 2026-05-13
**作者**: BrotherTian + Claude
**状态**: Design approved, ready for plan

## 1. 背景与目标

天哥的 Portfolio Dashboard 当前把三个仓位卡片（定投 / 现金 / 期权）纵向堆叠，每张卡片占据整行。要简化为**三列横向并排**的"驾驶舱"视图，让总仓位状态一眼可见。同时引入**现金跨 Bucket 拆分**逻辑，让现金仓的"目标线"成为绝对上限，超出部分作为期权策略的弹药展示。

不变的部分：上方的总资产进度条（`PortfolioOverview`）。本次改动只动它下面的三个 BucketCard 区域。

## 2. 用户故事

- 作为天哥，我打开 Dashboard 看一眼就能判断：当前定投/现金/期权三个仓位**各自相对目标偏离多少**，哪个红/黄/绿。
- 作为天哥，当我的现金超过目标 5%/10% 时，我希望系统**自动把超额部分计入期权仓**，因为那部分本来就是"准备打的子弹"。
- 作为天哥，我希望期权柱状图能告诉我：Sell Put / Sell Call / LEAPS 各自占期权仓多少，以及**目前有多少闲置现金还没部署**（柱状图的"现金"项）。

## 3. 数据逻辑（核心变化）

### 3.1 现金跨 Bucket 拆分规则

```
total_cash         = Σ(category === "cash" 的持仓 currentValue)
cash_target_pct    = targets.cash  (5% 有工资 / 10% 无工资)
cash_target_value  = totalValue × cash_target_pct / 100

cash_bucket_value      = min(total_cash, cash_target_value)
options_excess_cash    = max(0, total_cash - cash_target_value)
```

### 3.2 三个 Bucket 的最终金额

| Bucket | 金额计算 | 备注 |
|---|---|---|
| `safe-side` (DCA) | Σ DCA 持仓 currentValue | 不变 |
| `cash` | `cash_bucket_value` | 永远 ≤ 目标 |
| `options` | Σ \|期权持仓\| + `options_excess_cash` | 期权持仓用绝对值（short 是负数），加上超额现金 |

**不变式**: `safeSide + cash + options ≈ totalValue`（无重复计入）。

### 3.3 期权 Bar 的"现金"项

```
items = [
  { label: "Sell Put",   value: ΣSellPut,  target: 40% },
  { label: "Sell Call",  value: ΣSellCall, target: 40% },
  { label: "LEAPS Call", value: ΣLEAPS,    target: 20% },
  { label: "现金",       value: options_excess_cash, target: 0% },
]
```
"现金"项 target = 0 表示**理想状态是没有闲置现金**。柱状图颜色逻辑保留：超过 target+3% 黄，低于 target−3% 蓝，区间内绿。"现金"项 target=0 时只要 value>0 就会触发黄色，符合"看到黄色提醒该打子弹了"的诉求。

### 3.4 DCA Bar 的 Top 5 项

逻辑不变，沿用 [page.tsx#L43-L69](src/app/page.tsx#L43-L69)：
- 按 symbol 聚合 currentValue，取前 5
- ETF（QQQM/QQQ/QLD/VGT/VOO/SPY/FXAIX）目标 30%
- 个股目标 10%

### 3.5 现金 Bucket 颜色状态

因为 `cash_bucket_value ≤ cash_target_value`，现金饼图永远不会黄色，只有：
- 绿色：`|current% − target%| ≤ 1%`（基本达标）
- 蓝色：`current% < target% − 1%`（不够，需要补现金）

## 4. 布局结构

### 4.1 页面层级

```
<main max-w-7xl>
  H1 标题
  UploadZone
  PortfolioOverview （进度条，不动）
  <BucketsRow>            ← 新的三列容器
    BucketCard variant="wide"   key="safe-side"
    BucketCard variant="narrow" key="cash"
    BucketCard variant="wide"   key="options"
  </BucketsRow>
</main>
```

### 4.2 三列容器

```tsx
<div className="grid grid-cols-1 md:grid-cols-[2.5fr_1fr_2.5fr] gap-4 animate-fade-in"
     style={{ animationDelay: "0.2s", opacity: 0 }}>
  {current.buckets.map((bucket) => <BucketCard key={bucket.key} bucket={bucket} />)}
</div>
```

小屏（`< md`）回退到单列纵向，保持移动端可读。

### 4.3 BucketCard 三种内部布局

变体由 `bucket.key` 决定，组件接口不变。

**wide 变体（DCA / Options）**:
```
┌─────────────────────────────────────────┐
│ 标题（uppercase 小字）                   │
├─────────────────────────────────────────┤
│ ┌──────┐  bar1 ▓▓▓ N%(T%) $XX           │
│ │ pie  │  bar2 ▓▓  N%(T%) $XX           │
│ │ 140px│  bar3 ▓   N%(T%) $XX           │
│ └──────┘  bar4 ▓   N%(T%) $XX           │
│  58%      bar5 ▓   N%(T%) $XX           │
│ $232,000                                 │
└─────────────────────────────────────────┘
```

**narrow 变体（Cash）**:
```
┌────────────┐
│ 现金仓      │
├────────────┤
│  ┌──────┐  │
│  │ pie  │  │
│  │ 140px│  │
│  └──────┘  │
│    5.0%    │
│  $20,000   │
│ 现金在范围  │
│ 目标 5%    │
└────────────┘
```

### 4.4 字体

保留当前 `Inter` 体系（Inter Black `font-black`），大字号百分比作为主视觉。

### 4.5 配色（保留）

| 状态 | 条件 | 颜色 |
|---|---|---|
| 达标 | \|current − target\| ≤ 3% | green-500 / green-400 |
| 超过 | current > target + 3% | yellow-500 / yellow-400 |
| 不足 | current < target − 3% | blue-500 / blue-400 |

大字 % 颜色门槛收紧到 ±1%（保留当前 [BucketCard.tsx#L27-L32](src/components/BucketCard.tsx#L27-L32) 的逻辑）。

## 5. 文件改动清单

| 文件 | 改动类型 | 说明 |
|---|---|---|
| [src/app/page.tsx](src/app/page.tsx) | 重写 buildSnapshot 现金/期权部分 | ~40 行 |
| [src/app/page.tsx](src/app/page.tsx) | 容器从 `space-y-6` 改为 `grid 2.5fr 1fr 2.5fr` | ~5 行 |
| [src/app/page.tsx](src/app/page.tsx) | `max-w-6xl` → `max-w-7xl` | 1 行 |
| [src/components/BucketCard.tsx](src/components/BucketCard.tsx) | 重写为 wide/narrow 双变体 | ~60 行 |
| [src/lib/types.ts](src/lib/types.ts) | 无变化 | — |
| [src/__tests__/](src/__tests__/) | 更新现金/期权拆分预期 + 新增三场景测试 | ~30 行 |

## 6. 测试场景（新增）

1. **现金充足（在目标内）**: total_cash = 3%, target = 5% → cash bucket = 3%, options excess = 0, 现金饼蓝色。
2. **现金恰好达标**: total_cash = 5%, target = 5% → cash bucket = 5%, options excess = 0, 现金饼绿色。
3. **现金过剩**: total_cash = 8%, target = 5% → cash bucket = 5%, options excess = 3%（约 totalValue 的 3%），期权柱状图"现金"项显示黄色，金额 = totalValue × 3%。
4. **三 bucket 加总不变式**: `safeSide + cash + options === totalValue`（容差 < $1）。
5. **现金分类下持仓为 0**: total_cash = 0 → cash bucket = 0（蓝），options 无 excess。

## 7. 不在范围内（YAGNI）

- 多账户上传聚合（明确确认不需要，3 账户是比喻）。
- 期权柱状图"现金"项的 target 可配置化（暂时硬编码 0%）。
- 现金 bucket 颜色支持"yellow"（已确认永远不会黄）。
- 字体切换为 display 字体（已确认保留 Inter）。
- DCA Top 5 排序规则改变（保留按 currentValue 降序）。

## 8. 风险点

- **测试快照大改**: 当前测试假设现金 bucket 包含全部现金，全部需要重新计算预期值。
- **期权 bucket size 口径变化**: 从 `Σ|positions|` 改为 `Σ|positions| + excess_cash`，所有展示百分比会平移。
- **现金永远 ≤ 目标可能让用户困惑**: 看到现金一直显示 5%，可能误以为"我没攒到钱"。Cash 卡的状态文字需要明确说"超额现金已计入期权仓"。

## 9. 不变式（验证用）

```
∀ snapshot:
  cash_bucket_value      ≤ cash_target_value
  options_excess_cash    ≥ 0
  safeSide + cash + options ≈ totalValue (±$1)
  Σ(期权items.value)     = options.totalValue
```
