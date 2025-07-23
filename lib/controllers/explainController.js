const { GoogleGenerativeAI } = require('@google/generative-ai');
const { asyncHandler } = require('../middleware/errorHandler');

class ExplainController {
    explainAnswer = asyncHandler(async (req, res) => {
        const { question, answer, explanation } = req.body;
        
        if (!question || !answer) {
            return res.status(400).json({ 
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Question and answer are required' 
            });
        }
        
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            const prompt = `
Bạn là một giáo viên Vật lý giỏi. Hãy giải thích chi tiết câu trả lời sau:

Câu hỏi: ${question}
Đáp án: ${answer}
${explanation ? `Giải thích có sẵn: ${explanation}` : ''}

Hãy đưa ra lời giải thích chi tiết, dễ hiểu, bao gồm:
1. Phân tích câu hỏi
2. Các công thức/định luật liên quan (nếu có)
3. Cách giải từng bước
4. Kết luận

Trả lời bằng tiếng Việt, sử dụng ngôn ngữ phù hợp với học sinh trung học phổ thông.
            `.trim();
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            res.json({ 
                success: true,
                message: 'Explanation generated successfully',
                data: { 
                    explanation: text 
                }
            });
            
        } catch (error) {
            console.error('Error generating explanation:', error);
            res.status(500).json({ 
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Không thể tạo giải thích. Vui lòng thử lại sau.' 
            });
        }
    });
}

module.exports = new ExplainController();
