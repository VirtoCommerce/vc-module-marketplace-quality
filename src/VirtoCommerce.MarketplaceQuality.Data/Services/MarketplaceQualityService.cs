using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.Platform.Core.Settings;

namespace VirtoCommerce.MarketplaceQuality.Data.Services;

public class MarketplaceQualityService : IMarketplaceQualityService
{
    private readonly ISettingsManager _settingsManager;

    public MarketplaceQualityService(
        ISettingsManager settingsManager
        )
    {
        _settingsManager = settingsManager;
    }
    //public virtual Task<IList<string>> GetQualityTargetNamesAsync()
    //{
    //    IList<string> settingValues = _settingsManager.LoadAllowedValues(ModuleConstants.Settings.General.MarketplaceQualityTargets.Name)
    //        .Select(x => x.ToString())
    //        .ToList();

    //    return Task.FromResult(settingValues);
    //}
}
