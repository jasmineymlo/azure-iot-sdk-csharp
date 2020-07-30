// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Microsoft.Azure.Devices.Shared
{
    using Newtonsoft.Json;

    /// <summary>
    /// Details of the Configuration
    /// </summary>
    public class ConfigurationInfo
    {
        /// <summary>
        /// Configuration status.
        /// </summary>
        [JsonProperty("status")]
        public ConfigurationStatus Status { get; set; }
    }
}
