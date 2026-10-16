namespace backend.Models;

public class MealEntry
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string FoodInput { get; set; } = string.Empty;
    public string EatMore { get; set; } = string.Empty;
    public string EatLess { get; set; } = string.Empty;
    public string ActivityAdvice { get; set; } = string.Empty;
    public string CaloriesAdvice { get; set; } = string.Empty;
    public string MacroAdvice { get; set; } = string.Empty;
    public string NutritionBreakdown { get; set; } = string.Empty;
}
