using System.Threading;
using System.Threading.Tasks;

namespace VirtoCommerce.MarketplaceQuality.Data.VirtoOz;

public interface IVirtoOzChatClient
{
    /// <summary>
    /// Sends the message to the agent and waits until the agent run is over.
    /// VirtoOZ stops the run when the connection is closed, so the response stream is read to the end.
    /// </summary>
    /// <exception cref="VirtoOzException">The request was rejected, or the run ended with an error.</exception>
    Task SendMessageAsync(VirtoOzChatMessage message, string accessToken, CancellationToken cancellationToken);
}
