export default async function handler(req, res) {
    // Получаем имя пользователя из параметров запроса, по умолчанию - OstinUA
    const { username = 'OstinUA' } = req.query;

    try {
        // Запрос к GitHub API для получения количества PR пользователя
        const response = await fetch(`https://api.github.com/search/issues?q=is:pr+author:${username}`);
        const data = await response.json();
        
        // Получаем общее количество PR
        const totalPRs = data.total_count || 0;

        // Генерация SVG-кода
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="260" height="40" viewBox="0 0 260 40">
            <rect width="258" height="38" x="1" y="1" rx="6" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
            
            <svg x="10" y="12" width="16" height="16" viewBox="0 0 16 16" fill="#3fb950">
                <path fill-rule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1.5 1.5 0 011.5 1.5v5.628a2.25 2.25 0 101.5 0V5.5A3 3 0 0011 2.5zm1.25 9.25a.75.75 0 100 1.5.75.75 0 000-1.5zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"></path>
            </svg>

            <text x="35" y="25" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#c9d1d9">${username} Pull Requests</text>
            <text x="245" y="25" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#58a6ff" text-anchor="end">${totalPRs}</text>
        </svg>
        `;

        // Устанавливаем заголовки для корректного отображения и кэширования
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Кэш на 1 час для Vercel
        res.status(200).send(svg);
    } catch (error) {
        res.status(500).send('Error generating badge');
    }
}
