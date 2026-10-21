using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Data;
using backend.Models;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;

var envFile = new[]
{
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "backend", ".env")
}.FirstOrDefault(File.Exists);

if (envFile is not null)
{
    Env.Load(envFile);
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient(); 

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")?
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (allowedOrigins != null && allowedOrigins.Length > 0)
            {
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyHeader()
                      .AllowAnyMethod();
            }
            else
            {
                policy.SetIsOriginAllowed(_ => true)
                      .AllowAnyHeader()
                      .AllowAnyMethod();
            }
        });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=dietapp.db"));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");

app.MapGet("/api/meals", async (AppDbContext db) =>
{
    return await db.Meals.OrderByDescending(m => m.Date).ToListAsync();
})
.WithName("GetMeals")
.WithOpenApi();

app.MapPost("/api/meals", async (AppDbContext db, MealInputDto inputDto, IHttpClientFactory httpClientFactory, IConfiguration config) =>
{
    var apiKey = config["GroqApiKey"];
    
    if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GROQ_API_KEY_HERE")
    {
        return Results.BadRequest(new { message = "Groq API Key is missing. Set the GroqApiKey environment variable." });
    }

    try
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        
        var requestUrl = "https://api.groq.com/openai/v1/chat/completions";

        // Calculate approximate BMR/TDEE (assuming average age 25 for bachelor)
        double bmr = (10 * inputDto.WeightKg) + (6.25 * inputDto.HeightCm) - (5 * 25) + 5;
        double tdee = bmr * 1.55; // Moderate activity
        double targetCalories = tdee;
        if (inputDto.Goal.StartsWith("Bulk", StringComparison.OrdinalIgnoreCase)) targetCalories += 500;
        if (inputDto.Goal.StartsWith("Cut", StringComparison.OrdinalIgnoreCase)) targetCalories -= 500;
        double proteinMultiplier = 1.6; // Moderate/Maintain
        if (inputDto.Goal.StartsWith("Bulk", StringComparison.OrdinalIgnoreCase)) proteinMultiplier = 1.8;
        if (inputDto.Goal.StartsWith("Cut", StringComparison.OrdinalIgnoreCase)) proteinMultiplier = 2.0; // Higher on a cut to preserve muscle
        
        double targetProtein = inputDto.WeightKg * proteinMultiplier;
        double targetFats = (targetCalories * 0.25) / 9.0; // 25% of calories from fat
        double targetCarbs = (targetCalories - (targetProtein * 4.0) - (targetFats * 9.0)) / 4.0;

        var prompt = $"Profile: height {inputDto.HeightCm} cm, weight {inputDto.WeightKg} kg, goal {inputDto.Goal}. " +
                     $"Daily targets: {Math.Round(targetCalories)} kcal, {Math.Round(targetProtein)} g protein, " +
                     $"{Math.Round(targetCarbs)} g carbs, {Math.Round(targetFats)} g fat. " +
                     $"Analyze this meal: {inputDto.FoodInput}. " +
                     "Estimate nutrition for each listed food. Give concise, practical advice. " +
                     "Leave eatLess empty unless the meal includes something notably unhealthy. " +
                     "For macroAdvice, put protein, carbs, fats, and foods to eat on separate lines.";

        var requestBody = new
        {
            model = "openai/gpt-oss-20b",
            messages = new[]
            {
                new { role = "system", content = "You are a concise nutrition assistant. Estimate realistic nutrition for each food, and do not suggest leafy vegetables." },
                new { role = "user", content = prompt }
            },
            max_completion_tokens = 2048,
            include_reasoning = false,
            response_format = new
            {
                type = "json_schema",
                json_schema = new
                {
                    name = "nutrition_analysis",
                    strict = true,
                    schema = new
                    {
                        type = "object",
                        properties = new
                        {
                            eatMore = new { type = "string" },
                            eatLess = new { type = "string" },
                            activity = new { type = "string" },
                            caloriesAdvice = new { type = "string" },
                            macroAdvice = new { type = "string" },
                            nutritionBreakdown = new
                            {
                                type = "object",
                                properties = new
                                {
                                    foods = new
                                    {
                                        type = "array",
                                        items = new
                                        {
                                            type = "object",
                                            properties = new
                                            {
                                                name = new { type = "string" },
                                                amount = new { type = "string" },
                                                calories = new { type = "number" },
                                                protein = new { type = "number" },
                                                carbs = new { type = "number" },
                                                fat = new { type = "number" }
                                            },
                                            required = new[] { "name", "amount", "calories", "protein", "carbs", "fat" },
                                            additionalProperties = false
                                        }
                                    }
                                },
                                required = new[] { "foods" },
                                additionalProperties = false
                            }
                        },
                        required = new[] { "eatMore", "eatLess", "activity", "caloriesAdvice", "macroAdvice", "nutritionBreakdown" },
                        additionalProperties = false
                    }
                }
            }
        };

        var response = await client.PostAsJsonAsync(requestUrl, requestBody);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorText = await response.Content.ReadAsStringAsync();
            return Results.Problem($"Groq API Error: {errorText}");
        }

        var groqResponse = await response.Content.ReadFromJsonAsync<GroqResponse>();
        var aiText = groqResponse?.Choices?[0]?.Message?.Content ?? "{}";
        
        var analysis = JsonSerializer.Deserialize<AiAnalysis>(aiText, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        var nutritionBreakdown = analysis?.NutritionBreakdown;
        if (nutritionBreakdown is null ||
            nutritionBreakdown.Foods is null ||
            nutritionBreakdown.Foods.Count == 0)
        {
            return Results.Problem("The nutrition service did not return a per-food breakdown and total.");
        }

        nutritionBreakdown.Total = new NutritionTotals
        {
            Calories = nutritionBreakdown.Foods.Sum(food => food.Calories),
            Protein = nutritionBreakdown.Foods.Sum(food => food.Protein),
            Carbs = nutritionBreakdown.Foods.Sum(food => food.Carbs),
            Fat = nutritionBreakdown.Foods.Sum(food => food.Fat)
        };

        var meal = new MealEntry
        {
            FoodInput = inputDto.FoodInput,
            EatMore = analysis?.EatMore ?? "More data needed.",
            EatLess = analysis?.EatLess ?? "More data needed.",
            ActivityAdvice = analysis?.Activity ?? "Keep moving!",
            CaloriesAdvice = analysis?.CaloriesAdvice ?? "No calorie data provided.",
            MacroAdvice = analysis?.MacroAdvice ?? "No macro data provided.",
            NutritionBreakdown = JsonSerializer.Serialize(
                nutritionBreakdown,
                new JsonSerializerOptions(JsonSerializerDefaults.Web))
        };

        db.Meals.Add(meal);
        await db.SaveChangesAsync();

        return Results.Created($"/api/meals/{meal.Id}", meal);
    }
    catch (Exception ex)
    {
        return Results.Problem($"An error occurred during analysis: {ex.Message}");
    }
})
.WithName("LogMeal")
.WithOpenApi();

app.Run();

// DTOs and Deserialization Classes
public class MealInputDto
{
    public string FoodInput { get; set; } = string.Empty;
    public double HeightCm { get; set; }
    public double WeightKg { get; set; }
    public string Goal { get; set; } = "Maintain";
}

public class AiAnalysis
{
    public string EatMore { get; set; } = string.Empty;
    public string EatLess { get; set; } = string.Empty;
    public string Activity { get; set; } = string.Empty;
    public string CaloriesAdvice { get; set; } = string.Empty;
    public string MacroAdvice { get; set; } = string.Empty;
    public NutritionBreakdownData? NutritionBreakdown { get; set; }
}

public class NutritionBreakdownData
{
    public List<FoodNutrition>? Foods { get; set; }
    public NutritionTotals? Total { get; set; }
}

public class FoodNutrition
{
    public string Name { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public double Calories { get; set; }
    public double Protein { get; set; }
    public double Carbs { get; set; }
    public double Fat { get; set; }
}

public class NutritionTotals
{
    public double Calories { get; set; }
    public double Protein { get; set; }
    public double Carbs { get; set; }
    public double Fat { get; set; }
}

public class GroqResponse
{
    [JsonPropertyName("choices")]
    public Choice[]? Choices { get; set; }
}

public class Choice
{
    [JsonPropertyName("message")]
    public Message? Message { get; set; }
}

public class Message
{
    [JsonPropertyName("content")]
    public string? Content { get; set; }
}
