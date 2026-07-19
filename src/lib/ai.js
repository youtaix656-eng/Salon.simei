// AI相談機能 — ユーザー自身のAPIキーで Gemini / Claude に質問する。
// リクエスト組み立てとレスポンス解析は純関数に分離してテスト可能にしている。
// APIキーはこの端末の localStorage にのみ保存され、選択したAIプロバイダ以外には送信されない。
import { zoneLabels } from '../data/bodyZones.js';

export const PROVIDERS = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'Google AI Studio で無料で取得できます（無料枠あり）。',
  },
  claude: {
    id: 'claude',
    label: 'Anthropic Claude',
    defaultModel: 'claude-opus-4-8',
    keyUrl: 'https://console.anthropic.com/',
    keyHint: 'Anthropic Console で取得できます（従量課金）。',
  },
};

export function resolveModel(ai) {
  const provider = PROVIDERS[ai?.provider] || PROVIDERS.gemini;
  return (ai?.model || '').trim() || provider.defaultModel;
}

// セラピストの相談相手としてのシステムプロンプト。
// 指名・リピートに関する哲学は、指名の多いセラピストの実践知の要約をベースにしている。
export function buildSystemPrompt(settings = {}) {
  const name = settings.therapistName ? `${settings.therapistName}さん` : 'あなた';
  return [
    'あなたはリラクゼーションサロンで長年働き、指名ランキング上位の経験を持つベテランセラピストの先輩です。',
    `後輩セラピストの${name}からの相談に、実践的で具体的なアドバイスを日本語で答えてください。`,
    '',
    '指名・リピートについてのあなたの考え方（アドバイスの土台にする）：',
    '・指名されるのは技術や会話が上手い人ではなく「お客様の感情に感情を返せる人」。「気持ちよかった」と言われた瞬間に「そう言っていただけて嬉しいです。また担当させていただけたら嬉しいです」と本音を返すことが最大のきっかけになる。お願いは「〜してください」ではなく「〜させてほしい」の形。',
    '・軽快なトークは不要。清潔感、名前で呼ぶこと、オウム返しを含む傾聴、そして「お客様の要望どおりに施術すること」（首が辛いと言われたら首に時間を使う）が技術より重要。',
    '・リピートは、施術後に最適な来店頻度を理由つきで説明し「ご予約されますか？」とお客様にパスを渡すことで生まれる。何もしなければリピート率は1割程度。断られても、最初からリピートする気のないお客様はどの店でもリピートしないので自信を失わせない。',
    '・態度と質の安定感を保つこと、褒め言葉を謙遜せず受け取ること、自信を見せることが指名を守る。',
    '・集客の発信は症状の説明ではなく、悩みが起きる生活シーンへの共感から始める（共感→解決策は数字と変化後の生活→絞り込み→行動のハードルを下げる）。値引き集客は値段が判断基準のお客様を集めてしまう。「誰の役に立つ店か」を決めて発信し続ける。',
    '・接客の流れは「最初の5分の見立て（聴取→仮説→方針の合意）」→「施術中に変化を言葉で自覚してもらう」→「去り際に今日の成果と次回の予告という未来を手渡す」。質問は「どこが辛い？」より「今日はどんな疲れ方をされてますか？」。',
    '・沈黙は信頼のサイン。無駄話で埋めず、呼吸に合わせる。強さの確認は1回で十分。「もっと強く」には力ではなく沈める速度と深さで応える。筋肉は抜いた瞬間に緩む。',
    '・イラッとする場面では「心の矢印」を相手に向ける（例：遅刻客に「来てくださってありがとうございます。心配しました」）。共感と同調は区別し、プロとして解決へリードする。フリーのお客様には小さな提案と会話メモの活用で「覚えていてくれた人」になる。',
    '',
    '守ること：',
    '・施術テクニック、体勢の工夫、接客・会話、指名やリピートを増やす工夫など、現場ですぐ使える内容を優先する。',
    '・箇条書きを使い、簡潔に。長くても400字程度。',
    '・医療行為(診断・治療)にあたる助言はしない。痛みや痺れが強い、続く場合は施術を控えて医療機関の受診を勧める。',
    '・断定できないことは正直に伝える。',
  ].join('\n');
}

// ---- Gemini（REST API・ブラウザから直接呼び出し） ----

export function buildGeminiRequest(model, apiKey, system, chat) {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: chat.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      generationConfig: { maxOutputTokens: 1024 },
    },
  };
}

export function parseGeminiResponse(data) {
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  if (!text) {
    const reason = candidate?.finishReason || data?.promptFeedback?.blockReason;
    throw new Error(
      reason ? `回答を取得できませんでした（${reason}）` : '回答を取得できませんでした'
    );
  }
  return text;
}

async function askGemini(ai, chat, system) {
  const req = buildGeminiRequest(resolveModel(ai), ai.apiKey, system, chat);
  const res = await fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error?.message || `APIエラー（HTTP ${res.status}）`);
  }
  return parseGeminiResponse(await res.json());
}

// ---- Claude（公式SDK・ブラウザから直接呼び出し） ----

export function buildClaudeParams(model, system, chat) {
  return {
    model,
    max_tokens: 2048,
    system,
    messages: chat.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.text,
    })),
  };
}

export function extractClaudeText(message) {
  if (message.stop_reason === 'refusal') {
    throw new Error('この内容には回答できませんでした。質問を変えてみてください。');
  }
  const text = (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('回答を取得できませんでした');
  return text;
}

async function askClaude(ai, chat, system) {
  // SDKは必要になった時だけ読み込む（初回表示を軽くするため）
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ai.apiKey, dangerouslyAllowBrowser: true });
  const message = await client.messages.create(
    buildClaudeParams(resolveModel(ai), system, chat)
  );
  return extractClaudeText(message);
}

// ---- 共通入口 ----

// chat: [{role: 'user'|'assistant', text}] の履歴（最後がユーザーの質問）
export async function askAI(ai, chat, settings) {
  if (!ai?.apiKey) throw new Error('APIキーが設定されていません（設定画面から登録できます）');
  const system = buildSystemPrompt(settings);
  if (ai.provider === 'claude') return askClaude(ai, chat, system);
  return askGemini(ai, chat, system);
}

// ---- カルテ連携：施術プラン相談用プロンプト ----
// 個人を特定できる情報（お名前・ふりがな・誕生日・趣味/話題・会話メモ）は含めない。
// 含めるのは施術に関係する情報のみ：圧の好み・気になる部位・来店ペース・最近の施術メモ。
export function buildClientConsultPrompt(client, visits, options = {}) {
  const own = visits
    .filter((v) => v.clientId === client.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = own.slice(0, 3);
  const focus = [zoneLabels(client.bodyParts || []).join('・'), client.focusAreas]
    .filter(Boolean)
    .join('／');
  const lines = [
    'あるお客様（匿名）の次回の施術プランを相談させてください。',
    '',
    '【お客様の情報（匿名）】',
    `・圧の好み：${client.pressure || '記録なし'}`,
    `・気になる部位：${focus || '記録なし'}`,
    `・これまでの来店回数：${own.length}回`,
  ];
  if (options.intervalDays) lines.push(`・来店周期：約${options.intervalDays}日`);
  if (recent.length) {
    lines.push('・最近の施術：');
    for (const v of recent) {
      const note = v.notes ? `／メモ：${v.notes}` : '';
      lines.push(`　- ${v.menu || 'メニュー記録なし'}（${v.minutes || '?'}分）${note}`);
    }
  }
  lines.push(
    '',
    '次回来店時におすすめの施術の流れ（重点部位・アプローチの順番）と、',
    '満足度と指名につながる一言・気配りを簡潔に提案してください。'
  );
  return lines.join('\n');
}

// ---- 口コミ返信の例文作成 ----
// 貼り付けた口コミ（良い/悪い）に対する返信文をAIに作らせるプロンプト。
export function buildReviewReplyPrompt(reviewText, settings = {}, options = {}) {
  const signer = settings.therapistName ? `担当セラピストの${settings.therapistName}` : '担当セラピスト';
  const lines = [
    'リラクゼーションサロンの口コミサイトに投稿された、次の口コミへの返信文を作ってください。',
    '',
    '【口コミ】',
    reviewText.trim(),
    '',
    '【返信文の条件】',
    '・丁寧な敬語で、テンプレートっぽくならないよう口コミの内容に具体的に触れる',
    '・良い口コミなら：感謝 → 内容への言及 → 次回の来店が楽しみになる一言',
    '・悪い口コミなら：言い訳をせずまず謝罪 → 指摘の受け止め → 具体的な改善 → 可能ならまたの機会のお願い',
    '・お客様の実名やスタッフの個人情報は書かない',
    `・署名は「${signer}」として自然に締める`,
    '・200〜300字程度',
  ];
  if (options.extra) lines.push(`・追加の要望：${options.extra}`);
  lines.push('', '返信文のみを出力してください（前置きや解説は不要）。');
  return lines.join('\n');
}

// ---- トークスクリプトのAI言い換え ----
export function buildScriptRephrasePrompt(script, instruction, settings = {}) {
  const name = settings.therapistName ? `セラピストの${settings.therapistName}` : 'セラピスト';
  return [
    `リラクゼーションサロンの${name}が接客で使うセリフを言い換えてください。`,
    '',
    `【シーン】${script.scene}：${script.title}`,
    '【元のセリフ】',
    script.lines,
    script.point ? `【このセリフの狙い】${script.point}` : '',
    '',
    `【言い換えの要望】${instruction || '自分の言葉として自然に話せるように'}`,
    '',
    '狙いは保ったまま、話し言葉として自然なセリフを2案、番号付きで出してください。セリフのみを出力（解説不要）。',
  ]
    .filter(Boolean)
    .join('\n');
}
