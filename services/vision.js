import { GoogleGenAI } from '@google/genai';
import config from '../config/index.js';
import { boxToPixelCenter } from '../utils/coords.js';
import logger from '../utils/logger.js';

export class VisionService {
  constructor(apiKey = config.geminiApiKey, model = config.visionModel) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async locate(screenshot, description) {
    const { base64, width, height } = screenshot;

    const prompt = [
      'You are a precise UI element locator for browser automation.',
      `The screenshot is ${width}px wide and ${height}px tall.`,
      `Find this element: "${description}".`,
      'If the description refers to an ordinal item (e.g. "the 5th video"), count',
      'the matching items from the top of the list and return that specific one.',
      'Return ONLY JSON of the form:',
      '{"found": true, "box_2d": [ymin, xmin, ymax, xmax]}',
      'Coordinates MUST be integers normalized to 0-1000 (origin = top-left).',
      'Target the clickable/editable area itself, not its caption or label.',
      'If the element is not visible, return {"found": false}.',
    ].join('\n');

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    const parsed = this._parseJson(response.text);

    if (!parsed || parsed.found === false || !Array.isArray(parsed.box_2d)) {
      return { found: false, reason: `Vision could not locate "${description}".` };
    }

    const { x, y } = boxToPixelCenter(parsed.box_2d, width, height);
    logger.dim(
      `eyes: "${description}" -> box ${JSON.stringify(parsed.box_2d)} -> pixel (${x}, ${y})`,
    );
    return { found: true, x, y, box: parsed.box_2d };
  }

  async pickElement(elements, description) {
    const list = elements
      .map((e) => `[${e.index}] <${e.role}> "${e.name}"${e.inView ? '' : ' (below current view)'}`)
      .join('\n');

    const prompt = [
      'You are choosing ONE element to interact with on a web page.',
      'These are the interactive elements currently available, in top-to-bottom order:',
      list,
      '',
      `Choose the element that best matches: "${description}".`,
      'If the description means the Nth item of a kind (e.g. "the 5th video result"),',
      'count the matching elements from the top and choose that one.',
      'Respond ONLY with JSON: {"index": <number>} for your choice, or {"index": -1} if none matches.',
    ].join('\n');

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    const parsed = this._parseJson(response.text);
    const idx = parsed && Number.isInteger(parsed.index) ? parsed.index : -1;
    if (idx >= 0 && elements[idx]) {
      logger.dim(`dom-pick: "${description}" -> [${idx}] <${elements[idx].role}> "${elements[idx].name}"`);
    }
    return idx;
  }

  async describe(screenshot, question) {
    const { base64 } = screenshot;
    const prompt = question
      ? `Look at this web page screenshot and answer concisely: ${question}`
      : 'Concisely describe this web page screenshot: the main content, plus any ' +
        'dialogs, search boxes, buttons, or lists/results that are currently visible.';

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: { temperature: 0 },
    });

    return (response.text || '').trim();
  }

  _parseJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

let _vision = null;
export function getVision() {
  if (!_vision) _vision = new VisionService();
  return _vision;
}

export default getVision;
