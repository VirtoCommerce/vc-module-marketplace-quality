using System;

namespace VirtoCommerce.MarketplaceQuality.Data.VirtoOz;

public class VirtoOzException : Exception
{
    public VirtoOzException(string message, bool isTransient = false, TimeSpan? retryAfter = null)
        : base(message)
    {
        IsTransient = isTransient;
        RetryAfter = retryAfter;
    }

    /// <summary>
    /// The same request may succeed if sent again later: VirtoOZ or its LLM provider is overloaded or unavailable.
    /// </summary>
    public bool IsTransient { get; }

    public TimeSpan? RetryAfter { get; }
}
