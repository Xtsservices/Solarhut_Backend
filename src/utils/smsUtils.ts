import axios from 'axios';

export const sendOTPSMS = async (firstName: string, lastName: string, mobile: string, OTP: string): Promise<any> => {
  const template = 
  "Dear {#var#} Kindly use this {#var#} otp For Login  . thank You For choosing - SOLARHUT (METADEV).";

  // Function to populate the template with dynamic values
  function populateTemplate(template: string, values: string[]): string {
    let index = 0;
    return template.replace(/{#var#}/g, () => values[index++]);
  }

  // Populate the template with the user's name and OTP
  const name = `${firstName} ${lastName}`;
  const message = populateTemplate(template, [name, OTP]);

  const templateid = "1707176327698864461";

  try {
    // Check if SMS API key is configured
    if (!process.env.SMSAPIKEY) {
      console.error("SMS API Key not configured in environment variables");
      throw new Error("SMS service not configured");
    }

    const params = {
      username: "METADEV",
      apikey: process.env.SMSAPIKEY,
      senderid: "METSLH",
      mobile: mobile,
      message: message,
      templateid: templateid,
    };

    console.log(`Attempting to send SMS to ${mobile} for ${firstName} ${lastName}`);
    console.log("SMS Message:", message);

    // Call the sendSMS function
    const result = await sendSMS(params);
    console.log("SMS sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Error sending OTP SMS:", error);
    throw new Error("Failed to send OTP SMS");
  }
};


const sendSMS = async (params: any): Promise<any> => {
  try {
    const url = "http://wecann.in/v3/api.php";
    console.log("Sending SMS with params:", {
      ...params,
      apikey: params.apikey ? "[HIDDEN]" : "[MISSING]"
    });

    // Trigger the API using axios
    const response = await axios.get(url, { 
      params,
      timeout: 10000 // 10 second timeout
    });
    
    console.log("SMS API Response Status:", response.status);
    console.log("SMS API Response Data:", response.data);
    
    // Check if the SMS API returned an error
    if (response.data && typeof response.data === 'string' && response.data.toLowerCase().includes('error')) {
      throw new Error(`SMS API Error: ${response.data}`);
    }
    
    return response.data;
  } catch (error: any) {
    console.error("Error sending SMS:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};