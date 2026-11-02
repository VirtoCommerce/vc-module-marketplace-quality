using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using VirtoCommerce.MarketplaceQuality.Core;
using VirtoCommerce.Platform.Core.Settings;

namespace VirtoCommerce.MarketplaceQuality.Tests;

/// <summary>
/// Returns the module settings with the values set in <see cref="Values"/>; a setting without a value gets its default.
/// </summary>
public class SettingsManagerStub : ISettingsManager
{
    public Dictionary<string, object> Values { get; } = new();

    public IEnumerable<SettingDescriptor> AllRegisteredSettings => throw new NotImplementedException();

    public Task<ObjectSettingEntry> GetObjectSettingAsync(string name, string objectType = null, string objectId = null)
    {
        var descriptor = ModuleConstants.Settings.AllSettings.Single(x => x.Name == name);
        return Task.FromResult(new ObjectSettingEntry(descriptor) { Value = Values.GetValueOrDefault(name) });
    }

    public Task<IEnumerable<ObjectSettingEntry>> GetObjectSettingsAsync(IEnumerable<string> names, string objectType = null, string objectId = null)
    {
        throw new NotImplementedException();
    }

    public IEnumerable<SettingDescriptor> GetSettingsForType(string typeName)
    {
        throw new NotImplementedException();
    }

    public IDictionary<string, string[]> GetSettingTypeAssignments()
    {
        throw new NotImplementedException();
    }

    public void RegisterSettings(IEnumerable<SettingDescriptor> settings, string moduleId = null)
    {
        throw new NotImplementedException();
    }

    public void RegisterSettingsForType(IEnumerable<SettingDescriptor> settings, string typeName)
    {
        throw new NotImplementedException();
    }

    public Task RemoveObjectSettingsAsync(IEnumerable<ObjectSettingEntry> objectSettings)
    {
        throw new NotImplementedException();
    }

    public Task SaveObjectSettingsAsync(IEnumerable<ObjectSettingEntry> objectSettings)
    {
        throw new NotImplementedException();
    }
}
