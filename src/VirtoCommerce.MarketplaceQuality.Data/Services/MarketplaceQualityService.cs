using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core.Services;
using VirtoCommerce.MarketplaceVendorModule.Core;
using VirtoCommerce.Platform.Core.Settings;
using ModuleConstants = VirtoCommerce.MarketplaceQuality.Core.ModuleConstants;

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
    public virtual Task<IList<string>> GetQualityTargetNamesAsync()
    {
        IList<string> settingValues = _settingsManager.LoadAllowedValues(ModuleConstants.Settings.General.MarketplaceQualityTargets.Name)
            .Select(x => x.ToString())
            .ToList();

        return Task.FromResult(settingValues);
    }
}
