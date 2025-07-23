const fetch = require('node-fetch');
const { API_ENDPOINTS, APP_CONFIG } = require('../../config/constants');
const aiCacheService = require('../cache/aiCacheService');
const { sanitizeInput } = require('../../utils/sanitization');
const { GoogleGenAI } = require('@google/genai');

class AIService {
  constructor() {
    this.apiKey = APP_CONFIG.GEMINI_API_KEY;
    this.apiUrl = API_ENDPOINTS.GEMINI_URL;

    // Initialize Google GenAI for advanced features
    this.genAI = new GoogleGenAI({
      apiKey: this.apiKey
    });
  }

  // Format document content using AI
  async formatDocumentWithAI(text) {
    const prompt = `Bạn là một trợ lý AI chuyên định dạng nội dung bài học cho hệ thống giáo dục.

NHIỆM VỤ: Chuyển đổi văn bản sau thành định dạng bài học chuẩn với các câu hỏi trắc nghiệm.

YÊU CẦU ĐỊNH DẠNG:
1. Mỗi câu hỏi phải bắt đầu bằng "Câu X:" (X là số thứ tự)
2. Với câu hỏi trắc nghiệm ABCD:
   - Mỗi lựa chọn trên một dòng riêng: A. [nội dung]
   - Đánh dấu đáp án đúng bằng dấu * ở đầu: *A. [đáp án đúng]
   - Luôn có đủ 4 lựa chọn A, B, C, D
3. Với câu hỏi Đúng/Sai nhiều ý:
   - Mỗi ý trên một dòng: a) [nội dung]
   - Đánh dấu ý đúng bằng dấu *: *a) [ý đúng]
4. Với câu hỏi điền số:
   - Viết "Answer: [số]" trên dòng mới sau câu hỏi
5. Giữa các câu hỏi cách nhau một dòng trống

QUY TẮC CHUYỂN ĐỔI:
- Nếu văn bản có sẵn câu hỏi, TUYỆT ĐỐI GIỮ NGUYÊN và định dạng lại cho đúng chuẩn. Không được phép thay đổi câu hỏi và lựa chọn bằng bất kì lí do nào. Đảm bảo chuyển đổi TẤT CẢ các câu.
- Nếu văn bản là bài giảng/lý thuyết, tạo 5-10 câu hỏi trắc nghiệm dựa trên nội dung. Ưu tiên câu hỏi ABCD (6 câu), Đúng/Sai nhiều ý (2 câu tổng 8 ý), điền số (3 câu). Câu hỏi phải rõ ràng, súc tích, phù hợp với nội dung. Các lựa chọn phải hợp lý, độ khó tùy vào kiến thức gốc.
- Sử dụng latex đối với các phương trình trong cặp dấu $inline-latex$

VÍ DỤ OUTPUT:
Câu 1: Phương trình bậc hai $ax² + bx + c = 0$ có nghiệm khi nào?
A. $Δ > 0$
*B. $Δ ≥ 0$
C. $Δ < 0$
D. $Δ ≤ 0$

Câu 2: Các phát biểu sau về tam giác vuông, phát biểu nào đúng?
*a) Tổng hai góc nhọn bằng 90°
b) Cạnh huyền là cạnh nhỏ nhất
*c) Định lý Pytago: $a² + b² = c²$
d) Có thể có hai góc vuông

Câu 3: Tính diện tích hình tròn có bán kính 5cm (lấy π = 3.14)
Answer: 78.5

VĂN BẢN CẦN CHUYỂN ĐỔI:
${text}

OUTPUT (chỉ trả về nội dung đã định dạng, không giải thích thêm):`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            thinkingConfig: {
              thinkingBudget: 6000,
            },
            maxOutputTokens: 30000
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('Invalid AI response format:', data);
        throw new Error('Invalid AI response format');
      }

      let formattedContent = data.candidates[0].content.parts[0].text;

      // Clean up the response
      formattedContent = this.cleanupAIResponse(formattedContent);

      // Validate that we have at least one question
      if (!formattedContent.includes('Câu 1:')) {
        console.warn('AI response does not contain expected question format');
        throw new Error('AI không tạo được câu hỏi từ nội dung');
      }

      return formattedContent;

    } catch (error) {
      console.error('AI formatting error:', error);
      throw new Error('Không thể kết nối với AI để định dạng nội dung');
    }
  }

  // Clean up AI response
  cleanupAIResponse(content) {
    // Remove any markdown code blocks if present
    content = content.replace(/```[a-z]*\n/g, '');
    content = content.replace(/```/g, '');

    // Ensure proper line breaks first
    content = content.replace(/\r\n/g, '\n');

    // Remove existing point markings to prevent duplication
    // This handles cases where AI content might already have point markings
    content = content.replace(/\s*\[\s*[\d.]+\s*pts?\s*\]/gi, '');

    // Clean up excessive whitespace but preserve line breaks
    // Replace multiple spaces/tabs with single space, but keep newlines
    content = content.replace(/[ \t]+/g, ' ');
    // Remove excessive newlines (more than 2 consecutive)
    content = content.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    content = content.trim();

    return content;
  }

  // Enhanced lesson summary generation with better context understanding
  async generateLessonSummary(lessonData) {
    // Check cache first
    const cachedResult = await aiCacheService.get('summary', lessonData);
    if (cachedResult) {
      console.log('Using cached lesson summary');
      return cachedResult.summary || cachedResult;
    }

    // Extract lesson context from various sources
    let lessonContext = '';
    
    if (typeof lessonData === 'string') {
      // Legacy support: if just a string is passed
      lessonContext = lessonData;
    } else {
      // Build comprehensive context from lesson data with sanitization
      const { title, questions, grade, subject, tags } = lessonData;
      
      lessonContext = `Tiêu đề bài học: ${sanitizeInput(title) || 'Không có tiêu đề'}\n`;
      lessonContext += `Môn học: ${sanitizeInput(subject) || 'Vật lý'}\n`;
      lessonContext += `Lớp: ${sanitizeInput(grade) || 'Không xác định'}\n`;
      if (tags && tags.length > 0) {
        lessonContext += `Chủ đề: ${tags.join(', ')}\n`;
      }
      lessonContext += '\nNội dung câu hỏi:\n';
      
      // Extract key concepts from questions
      if (questions && Array.isArray(questions)) {
        questions.forEach((q, index) => {
          if (q.question) {
            lessonContext += `${index + 1}. ${q.question}\n`;
          }
        });
      }
    }

    const prompt = `Bạn là giáo viên vật lý giàu kinh nghiệm. Hãy tạo mô tả ngắn gọn và hấp dẫn cho bài học sau:

${lessonContext}

YÊU CẦU:
- Mô tả phải dài 3-4 câu, súc tích nhưng đầy đủ thông tin
- Nêu rõ kiến thức chính học sinh sẽ học được
- Có thể đề cập đến ứng dụng thực tế nếu phù hợp
- Viết theo phong cách mô tả trực tiếp
- Phải liên quan trực tiếp đến nội dung bài học này.

VÍ DỤ MẪU:
- "Khám phá nguyên lý hoạt động của đòn bẩy và ròng rọc trong cuộc sống hàng ngày. Học cách tính toán lực và khoảng cách để nâng vật nặng dễ dàng hơn."
- "Tìm hiểu về chuyển động thẳng đều và các công thức tính vận tốc, quãng đường. Áp dụng kiến thức để giải quyết các bài toán thực tế về giao thông."

MÔ TẢ (chỉ trả về mô tả, không giải thích thêm):`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7, // Higher for more creative summaries
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 8000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid AI response format');
      }

      const summary = this.cleanupAIResponse(data.candidates[0].content.parts[0].text);
      
      // Validate summary quality
      if (summary.length < 50 || summary.length > 500) {
        throw new Error('Generated summary does not meet length requirements');
      }
      
      // Cache the result
      await aiCacheService.set('summary', lessonData, summary, 3600); // Cache for 1 hour
      
      return summary;

    } catch (error) {
      console.error('Error generating lesson summary:', error);
      // Return a fallback summary if AI fails
      const fallbackSubject = lessonData.subject || 'Vật lý';
      const fallbackGrade = lessonData.grade || '';
      return `Bài học ${fallbackSubject} ${fallbackGrade} với các câu hỏi trắc nghiệm và bài tập thực hành. Phù hợp cho học sinh muốn ôn tập và nâng cao kiến thức.`;
    }
  }

  // Generate image prompt for lesson visualization
  async generateImagePrompt() {
    const prompt = `Tạo một mô tả hình ảnh (prompt) 
- Phải là tiếng Anh, ngắn gọn (tối đa 50 từ)
- Mô tả một hình ảnh ngẫu nhiên nhưng tuyệt đối không có con người.
- Prompt tuân theo cấu trúc sau:{description} = {focusDetailed},%20{adjective1},%20{adjective2},%20{visualStyle1},%20{visualStyle2},%20{visualStyle3},%20{artistReference}
Ví dụ: A photo of a cat on a couch, comfortable, cute, colourful, interior design, Ansel Adams.
Ví dụ: A fox wearing a cloak, cinematic, heroic, professional photography, 4k, photo realistic, Tim Burton.

PROMPT TIẾNG ANH (chỉ trả về prompt, không giải thích):`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 2,
            topK: 300,
            topP: 0.9,
            maxOutputTokens: 8000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid AI response format');
      }

      const imagePrompt = this.cleanupAIResponse(data.candidates[0].content.parts[0].text);
      
      // Add standard suffix for consistency
      const enhancedPrompt = `${imagePrompt}`;
      
      return enhancedPrompt;

    } catch (error) {
      console.error('Error generating image prompt:', error);
      // Return a fallback prompt
      return 'A vast, starry night sky above mountains.';
    }
  }

  // Sanitize and translate user-defined image prompt
  async sanitizeImagePrompt(userPrompt) {
    if (!userPrompt || userPrompt.trim() === '') {
      throw new Error('User prompt is empty');
    }

    const prompt = `Bạn là một trợ lý AI chuyên xử lý mô tả hình ảnh.

NHIỆM VỤ: Xử lý mô tả hình ảnh do người dùng nhập vào để tạo prompt phù hợp cho AI tạo ảnh.

YÊU CẦU XỬ LÝ:
1. Kiểm tra và loại bỏ nội dung không phù hợp (bạo lực, khiêu dâm, chính trị nhạy cảm)
2. Dịch sang tiếng Anh
3. Tối ưu hóa cho AI tạo ảnh (rõ ràng, cụ thể, mô tả thị giác)
4. Loại bỏ yêu cầu về con người cụ thể hoặc nhân vật có thật
5. Giới hạn trong 50 từ

QUY TẮC:
- Nếu nội dung không phù hợp: trả về "INAPPROPRIATE_CONTENT"
- Nếu phù hợp: trả về prompt tiếng Anh đã tối ưu
- Chỉ trả về kết quả, không giải thích

INPUT = {focus}
OUTPUT = {description} 
{description} = {focusDetailed},%20{adjective1},%20{adjective2},%20{visualStyle1},%20{visualStyle2},%20{visualStyle3},%20{artistReference}

INPUT = a photo of a cat
OUTPUT = A photo of a cat on a couch, comfortable, cute, colourful, interior design, Ansel Adams

INPUT = Fox with a cloak
OUTPUT = A fox wearing a cloak, cinematic, heroic, professional photography, 4k, photo realistic, Tim Burton

INPUT: "${sanitizeInput(userPrompt)}"
OUTPUT:`;

    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent results
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 8000
        }
      };

      console.log('Sending request to Gemini API for prompt sanitization...');
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error ${response.status}:`, errorText);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      console.log('Gemini API response:', JSON.stringify(data, null, 2));

      // Handle different possible response formats
      let responseText = '';

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = data.candidates[0].content.parts[0].text;
      } else if (data.candidates?.[0]?.output) {
        responseText = data.candidates[0].output;
      } else if (data.text) {
        responseText = data.text;
      } else if (data.response) {
        responseText = data.response;
      } else {
        console.error('Unexpected Gemini API response format:', data);
        throw new Error('Invalid AI response format - no text content found');
      }

      const sanitizedPrompt = this.cleanupAIResponse(responseText);

      // Check if content was deemed inappropriate
      if (sanitizedPrompt.includes('INAPPROPRIATE_CONTENT')) {
        throw new Error('Nội dung không phù hợp với môi trường giáo dục');
      }

      return sanitizedPrompt;

    } catch (error) {
      console.error('Error sanitizing image prompt:', error);

      // Fallback: basic sanitization without AI
      console.log('Falling back to basic sanitization...');

      // Basic inappropriate content filtering
      const inappropriateWords = ['sex', 'nude', 'naked', 'porn', 'violence', 'kill', 'death', 'blood'];
      const lowerPrompt = userPrompt.toLowerCase();

      for (const word of inappropriateWords) {
        if (lowerPrompt.includes(word)) {
          throw new Error('Nội dung không phù hợp với môi trường giáo dục');
        }
      }

      // Basic cleanup and return original prompt if it seems safe
      const cleanPrompt = userPrompt
        .replace(/[^\w\s,.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);

      return cleanPrompt || 'A beautiful educational illustration';
    }
  }

  // Generate question explanations using AI
  async generateQuestionExplanation(question, correctAnswer, studentAnswer) {
    // Create cache key from question parameters
    const explanationData = { question, correctAnswer, studentAnswer };
    const cachedResult = await aiCacheService.get('explanation', explanationData);
    if (cachedResult) {
      console.log('Using cached question explanation');
      return cachedResult.explanation || cachedResult;
    }

    const prompt = `Giải thích tại sao đáp án đúng cho câu hỏi sau:

Câu hỏi: ${question}
Đáp án đúng: ${correctAnswer}
Đáp án học sinh chọn: ${studentAnswer}

Yêu cầu:
- Giải thích ngắn gọn, dễ hiểu
- Nêu rõ tại sao đáp án đúng là chính xác
- Nếu học sinh chọn sai, giải thích tại sao đáp án đó không đúng
- Tối đa 2-3 câu`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 8000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid AI response format');
      }

      const explanation = this.cleanupAIResponse(data.candidates[0].content.parts[0].text);
      
      // Cache the result
      await aiCacheService.set('explanation', explanationData, explanation, 1800); // Cache for 30 minutes
      
      return explanation;

    } catch (error) {
      console.error('Error generating question explanation:', error);
      throw new Error('Không thể tạo giải thích câu hỏi');
    }
  }

  // Validate AI service configuration
  validateConfiguration() {
    const errors = [];

    if (!this.apiKey) {
      errors.push('GEMINI_API_KEY is not configured');
    }

    if (!this.apiUrl) {
      errors.push('Gemini API URL is not configured');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate AI tag suggestions for a lesson
  async generateTagSuggestions(lessonData, existingTags) {
    const cacheKey = `tag_suggestions_${JSON.stringify(lessonData)}_${existingTags.join(',')}`;

    // Check cache first
    const cached = await aiCacheService.get('tag_suggestions', cacheKey);
    if (cached) {
      return cached;
    }

    // Create a comprehensive lesson description for AI analysis
    const lessonDescription = this.createLessonDescription(lessonData);

    const prompt = `Bạn là một chuyên gia giáo dục AI chuyên phân tích và gắn thẻ nội dung bài học.

THÔNG TIN BÀI HỌC:
${lessonDescription}

DANH SÁCH TẤT CẢ CÁC TAG HIỆN CÓ TRONG HỆ THỐNG:
${existingTags.map(tag => `- ${tag}`).join('\n')}

NHIỆM VỤ:
1. Phân tích nội dung bài học và chọn các tag phù hợp nhất từ danh sách có sẵn
2. Đề xuất 3 tag mới có thể hữu ích cho bài học này

YÊU CẦU ĐỊNH DẠNG XML:
<existing_tags>
[Liệt kê các tag từ danh sách có sẵn phù hợp với bài học, mỗi tag trên một dòng]
</existing_tags>

<suggested_tags>
[Đề xuất 3 tag mới, mỗi tag trên một dòng, KHÔNG có dấu tiếng Việt, KHÔNG có khoảng trắng, chỉ dùng chữ cái Latin thường]
</suggested_tags>

LƯU Ý:
- Chỉ chọn tag từ danh sách có sẵn nếu thực sự phù hợp
- Tag mới PHẢI tuân thủ format: không dấu, không khoảng trắng, chỉ chữ cái Latin thường
- Ví dụ tag mới hợp lệ: "vatly10", "chuyendong", "kinhhoc", "bailuyen"
- Ưu tiên tag mô tả chủ đề, cấp độ, loại bài tập
- Không lặp lại tag đã có trong danh sách`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 8000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid AI response format');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const suggestions = this.parseTagSuggestions(responseText);

      // Cache the result
      await aiCacheService.set('tag_suggestions', cacheKey, suggestions, 1800); // Cache for 30 minutes

      return suggestions;

    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      // Return fallback suggestions
      return {
        existingTags: [],
        suggestedTags: ['bài tập', 'ôn tập', 'kiểm tra']
      };
    }
  }

  // Helper method to create lesson description for AI analysis
  createLessonDescription(lessonData) {
    let description = `Tiêu đề: ${lessonData.title || 'Không có tiêu đề'}\n`;
    description += `Môn học: ${lessonData.subject || 'Vật lý'}\n`;
    description += `Khối: ${lessonData.grade || 'Không xác định'}\n`;
    description += `Mục đích: ${lessonData.purpose || 'Không xác định'}\n`;

    if (lessonData.description) {
      description += `Mô tả: ${lessonData.description}\n`;
    }

    if (lessonData.tags && lessonData.tags.length > 0) {
      description += `Tag hiện tại: ${lessonData.tags.join(', ')}\n`;
    }

    if (lessonData.questions && lessonData.questions.length > 0) {
      description += `\nSố câu hỏi: ${lessonData.questions.length}\n`;

      // Analyze question types
      const questionTypes = { abcd: 0, truefalse: 0, number: 0 };
      lessonData.questions.forEach(q => {
        if (q.type === 'abcd') questionTypes.abcd++;
        else if (q.type === 'truefalse') questionTypes.truefalse++;
        else if (q.type === 'number') questionTypes.number++;
      });

      description += `Loại câu hỏi: ABCD (${questionTypes.abcd}), Đúng/Sai (${questionTypes.truefalse}), Điền số (${questionTypes.number})\n`;

      // Add sample questions for context
      const sampleQuestions = lessonData.questions.slice(0, 3);
      description += `\nMẫu câu hỏi:\n`;
      sampleQuestions.forEach((q, index) => {
        description += `${index + 1}. ${q.question || q.text || 'Không có nội dung'}\n`;
      });
    }

    return description;
  }

  // Helper method to parse AI tag suggestions response
  parseTagSuggestions(responseText) {
    const result = {
      existingTags: [],
      suggestedTags: []
    };

    try {
      // Extract existing tags
      const existingMatch = responseText.match(/<existing_tags>(.*?)<\/existing_tags>/s);
      if (existingMatch) {
        const existingTagsText = existingMatch[1].trim();
        result.existingTags = existingTagsText
          .split('\n')
          .map(line => line.trim().replace(/^-\s*/, ''))
          .filter(tag => tag.length > 0);
      }

      // Extract suggested tags
      const suggestedMatch = responseText.match(/<suggested_tags>(.*?)<\/suggested_tags>/s);
      if (suggestedMatch) {
        const suggestedTagsText = suggestedMatch[1].trim();
        result.suggestedTags = suggestedTagsText
          .split('\n')
          .map(line => line.trim().replace(/^-\s*/, ''))
          .filter(tag => tag.length > 0)
          .slice(0, 3); // Limit to 3 suggestions
      }

    } catch (error) {
      console.error('Error parsing tag suggestions:', error);
    }

    return result;
  }

  // Test AI service connectivity
  async testConnection() {
    try {
      const testPrompt = "Trả lời: OK";
      
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: testPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format');
      }

      return {
        success: true,
        message: 'AI service is working correctly'
      };

    } catch (error) {
      return {
        success: false,
        message: `AI service test failed: ${error.message}`
      };
    }
  }

  /**
   * Unified AI chat assistance method with streaming support
   * @param {string} message - User message/request
   * @param {Object} lessonContent - Current lesson content
   * @param {Object} options - Options for streaming, tools, etc.
   * @param {Function} onChunk - Optional callback for streaming chunks
   * @returns {Object|Promise} - { message: string, actions: Array } or streaming promise
   */
  async generateChatAssistance(message, lessonContent, options = {}, onChunk = null) {
    const {
      stream = false,
      useGoogleSearch = false,
      toolMode = 'url',
      useCache = true
    } = options;

    // For streaming, don't use cache and call streaming method
    if (stream && onChunk) {
      return await this.streamChatResponse(message, lessonContent, options, onChunk);
    }

    // Check cache first (only for non-streaming)
    let cacheKey;
    if (useCache) {
      cacheKey = `chat_assist_${Buffer.from(message + JSON.stringify(lessonContent) + JSON.stringify(options)).toString('base64').slice(0, 32)}`;
      const cached = await aiCacheService.get('chat_assistance', cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Prepare tools based on options
      const tools = [];
      if (useGoogleSearch) {
        tools.push({ googleSearch: {} });
      }
      if (toolMode === 'url') {
        tools.push({ urlContext: {} });
      } else if (toolMode === 'code') {
        tools.push({ codeExecution: {} });
      }

      const systemInstruction = `Bạn là AI trợ lý hữu ích.

THÔNG TIN BÀI HỌC HIỆN TẠI:
${lessonContent.rawText ? `Nội dung: ${lessonContent.rawText}` : 'Chưa có nội dung'}
${lessonContent.questions ? `Số câu hỏi: ${lessonContent.questions.length}` : 'Chưa có câu hỏi'}

CÔNG CỤ HIỆN TẠI:
${useGoogleSearch ? '- Google Search: Có thể tìm kiếm thông tin trên Google' : ''}
${toolMode === 'url' ? '- URL Context: Có thể đọc và phân tích nội dung từ URL' : ''}
${toolMode === 'code' ? '- Code Execution: Có thể thực thi Python code để tính toán và vẽ đồ thị' : ''}


HƯỚNG DẪN TRẢ LỜI:
- Sử dụng định dạng Markdown cho tất cả phản hồi
- Trả lời một cách chính thức nhưng trực tiếp và rõ ràng
- Chia nội dung thành các phần rõ ràng với tiêu đề markdown
- Sử dụng danh sách có dấu đầu dòng khi thích hợp
- Đặt code, công thức, hoặc nội dung có thể sao chép trong khối code
- Sử dụng LaTeX cho công thức toán học với cú pháp ký hiệu đô la
- Sử dụng các công cụ có sẵn để cung cấp thông tin chính xác
- Đưa ra gợi ý cụ thể và hữu ích cho việc tạo bài học
- Thay đổi một cách tự nhiên theo nhu cầu của người dùng. Bạn hoàn toàn có thể trò chuyện và giao tiếp như một chatbot bình thường, không bị giới hạn lĩnh vực làm việc.
Ví dụ, nếu người dùng hỏi về thời tiết, trả lời câu hỏi về  thời tiết mà không cần đề cập về bài học.
Nếu người dùng hỏi về thông tin mới, trả lời câu hỏi về thông tin mới mà không cần đề cập về bài học.
Nếu người dùng xin lời khuyên cá nhân, trả lời mà không cần đề cập về bài học.
nếu người dùng hỏi về bài tập nào đó mà không liên quan đến bài học, không cần đề cập về bài học.
Nếu người dùng hỏi liên quan đến bài học, thì mới cần đề cập đến bài học.

Hãy trả lời một cách hữu ích và chi tiết theo định dạng Markdown:`;


      const config = {
        temperature: 1,
        thinkingConfig: {
          thinkingBudget: 2000,
        },
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4000,
        responseMimeType: 'text/plain'
      };

      let aiResponse;

      // Use Google GenAI if tools are needed, otherwise use regular Gemini API
      if (tools.length > 0) {
        config.tools = tools;
        config.systemInstruction = [{ text: systemInstruction }];

        const response = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          config,
          contents: [
            {
              role: 'user',
              parts: [{ text: message }]
            }
          ]
        });

        if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid AI response format');
        }

        aiResponse = this.cleanupAIResponse(response.candidates[0].content.parts[0].text);
      } else {
        // Use regular Gemini API for basic chat
        const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: systemInstruction + '\n\nYÊU CẦU CỦA NGƯỜI DÙNG:\n' + message
              }]
            }],
            generationConfig: config
          })
        });

        if (!response.ok) {
          throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid AI response format');
        }

        aiResponse = this.cleanupAIResponse(data.candidates[0].content.parts[0].text);
      }

      const result = {
        message: aiResponse,
        actions: []
      };

      // Cache the result (only for non-streaming)
      if (useCache) {
        await aiCacheService.set('chat_assistance', cacheKey, result, 1800); // Cache for 30 minutes
      }

      return result;

    } catch (error) {
      console.error('Error generating chat assistance:', error);

      // Return fallback response
      return {
        message: 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau hoặc mô tả chi tiết hơn yêu cầu của bạn.',
        actions: []
      };
    }
  }

  /**
   * Stream chat response with true streaming using Google GenAI
   * @param {string} message - User message/request
   * @param {Object} lessonContent - Current lesson content
   * @param {Object} options - Options for tools, etc.
   * @param {Function} onChunk - Callback for each chunk of response
   */
  async streamChatResponse(message, lessonContent, options, onChunk) {
    const { useGoogleSearch = false, toolMode = 'url' } = options;

    try {
      // Prepare tools based on options
      const tools = [];
      if (useGoogleSearch) {
        tools.push({ googleSearch: {} });
      }
      if (toolMode === 'url') {
        tools.push({ urlContext: {} });
      } else if (toolMode === 'code') {
        tools.push({ codeExecution: {} });
      }

      const systemInstruction = `Bạn là AI trợ lý hữu ích. Nhiệm vụ của bạn là hỗ trợ giáo viên tạo và cải thiện bài học.

THÔNG TIN BÀI HỌC HIỆN TẠI:
${lessonContent.rawText ? `Nội dung: ${lessonContent.rawText}` : 'Chưa có nội dung'}
${lessonContent.questions ? `Số câu hỏi: ${lessonContent.questions.length}` : 'Chưa có câu hỏi'}

CÔNG CỤ HIỆN TẠI:
${useGoogleSearch ? '- Google Search: Có thể tìm kiếm thông tin trên Google' : ''}
${toolMode === 'url' ? '- URL Context: Có thể đọc và phân tích nội dung từ URL' : ''}
${toolMode === 'code' ? '- Code Execution: Có thể thực thi Python code để tính toán và vẽ đồ thị' : ''}

HƯỚNG DẪN TRẢ LỜI:
- Sử dụng định dạng Markdown cho tất cả phản hồi
- Trả lời một cách chính thức nhưng trực tiếp và rõ ràng
- Chia nội dung thành các phần rõ ràng với tiêu đề markdown
- Sử dụng danh sách có dấu đầu dòng khi thích hợp
- Đặt code, công thức, hoặc nội dung có thể sao chép trong khối code
- Sử dụng LaTeX cho công thức toán học với cú pháp ký hiệu đô la
- Sử dụng các công cụ có sẵn để cung cấp thông tin chính xác
- Đưa ra gợi ý cụ thể và hữu ích cho việc tạo bài học
- Thay đổi một cách tự nhiên theo nhu cầu của người dùng

Hãy trả lời một cách hữu ích và chi tiết theo định dạng Markdown:`;

      const config = {
        temperature: 1,
        thinkingConfig: {
          thinkingBudget: 2000,
        },
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4000,
        responseMimeType: 'text/plain'
      };

      if (tools.length > 0) {
        config.tools = tools;
        config.systemInstruction = [{ text: systemInstruction }];
      }

      // Use true streaming with Google GenAI
      const stream = await this.genAI.models.generateContentStream({
        model: 'gemini-2.5-flash',
        config,
        contents: [
          {
            role: 'user',
            parts: [{ text: message }]
          }
        ]
      });

      // Process streaming chunks
      for await (const chunk of stream) {
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
          const chunkText = chunk.candidates[0].content.parts[0].text;
          onChunk(chunkText);
        }
      }

    } catch (error) {
      console.error('Error in streaming chat response:', error);
      onChunk('Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.');
    }
  }



  /**
   * Analyze lesson content and provide insights
   * @param {Object} lessonContent - Lesson content to analyze
   * @returns {string} - Analysis text
   */
  async analyzeLessonContent(lessonContent) {
    const cacheKey = `lesson_analysis_${Buffer.from(JSON.stringify(lessonContent)).toString('base64').slice(0, 32)}`;

    // Check cache first
    const cached = await aiCacheService.get('lesson_analysis', cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = `Phân tích bài học vật lý sau đây và đưa ra đánh giá chi tiết:

THÔNG TIN BÀI HỌC:
${lessonContent.rawText || 'Không có nội dung'}

SỐ LƯỢNG CÂU HỎI: ${lessonContent.questions ? lessonContent.questions.length : 0}

HÃY PHÂN TÍCH THEO CÁC TIÊU CHÍ SAU:

📊 **TỔNG QUAN BÀI HỌC**
- Đánh giá chất lượng tổng thể
- Mức độ phù hợp với học sinh

🎯 **PHÂN TÍCH CÂU HỎI**
- Phân bố độ khó (dễ/trung bình/khó)
- Đa dạng dạng câu hỏi
- Chất lượng đáp án

📝 **ĐIỂM MẠNH**
- Những ưu điểm nổi bật
- Câu hỏi hay, sáng tạo

⚠️ **ĐIỂM CẦN CẢI THIỆN**
- Vấn đề cần khắc phục
- Gợi ý cải thiện cụ thể

💡 **ĐỀ XUẤT**
- Thêm câu hỏi về chủ đề nào
- Điều chỉnh độ khó
- Cải thiện cấu trúc

Trả lời bằng tiếng Việt, chi tiết và có cấu trúc rõ ràng.`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.5,
            topK: 30,
            topP: 0.8,
            maxOutputTokens: 8000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid AI response format');
      }

      const analysis = this.cleanupAIResponse(data.candidates[0].content.parts[0].text);

      // Cache the result
      await aiCacheService.set('lesson_analysis', cacheKey, analysis, 1800); // Cache for 30 minutes

      return analysis;

    } catch (error) {
      console.error('Error analyzing lesson content:', error);

      // Return fallback analysis
      const questionCount = lessonContent.questions ? lessonContent.questions.length : 0;
      const hasContent = lessonContent.rawText && lessonContent.rawText.trim().length > 0;

      return `📊 **PHÂN TÍCH NHANH**

**Tình trạng bài học:**
- ${hasContent ? 'Đã có nội dung' : 'Chưa có nội dung'}
- Số câu hỏi: ${questionCount}

**Đề xuất:**
${questionCount === 0 ? '- Thêm câu hỏi để bắt đầu bài học' : ''}
${questionCount < 5 ? '- Nên có ít nhất 5-10 câu hỏi cho một bài học hoàn chỉnh' : ''}
${!hasContent ? '- Thêm nội dung mô tả cho bài học' : ''}

*Lưu ý: Đang gặp sự cố kỹ thuật trong việc phân tích chi tiết. Vui lòng thử lại sau.*`;
    }
  }
}

module.exports = new AIService();