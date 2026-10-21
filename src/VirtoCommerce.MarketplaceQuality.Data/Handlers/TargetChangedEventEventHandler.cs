using System.Linq;
using System.Threading.Tasks;
using VirtoCommerce.CatalogQuality.Core.Events;
using VirtoCommerce.MarketplaceVendorModule.Core;
using VirtoCommerce.Platform.Core.Common;
using VirtoCommerce.Platform.Core.Events;
using VirtoCommerce.Platform.Core.Settings;
using ModuleConstants = VirtoCommerce.MarketplaceQuality.Core.ModuleConstants;

namespace VirtoCommerce.MarketplaceQuality.Data.Handlers;

public class TargetChangedEventEventHandler : IEventHandler<TargetChangedEvent>
{
    private readonly ISettingsManager _settingsManager;

    public TargetChangedEventEventHandler(
        ISettingsManager settingsManager
        )
    {
        _settingsManager = settingsManager;
    }

    public virtual Task Handle(TargetChangedEvent message)
    {
        if (!message.ChangedEntries.Any(x => x.EntryState == EntryState.Modified))
        {
            return Task.CompletedTask;
        }

        var settingValues = _settingsManager.LoadAllowedValues(ModuleConstants.Settings.General.MarketplaceQualityTargets.Name);
        var needResave = false;

        var renamedTargets = message.ChangedEntries
            .Where(x => x.EntryState == EntryState.Modified
                        && x.OldEntry?.Name != null
                        && x.NewEntry?.Name != null
                        && x.OldEntry.Name != x.NewEntry.Name)
            .GroupBy(x => x.OldEntry.Name)
            .ToDictionary(x => x.Key, x => x.Last().NewEntry.Name);

        for (int i = 0; i < settingValues.Length; i++)
        {
            if (settingValues[i] is string currentValue && renamedTargets.TryGetValue(currentValue, out var newValue))
            {
                settingValues[i] = newValue;
                needResave = true;
            }
        }

        if (needResave)
        {
            _settingsManager.SetAllowedValues(ModuleConstants.Settings.General.MarketplaceQualityTargets.Name, settingValues);
        }

        return Task.CompletedTask;
    }

}
