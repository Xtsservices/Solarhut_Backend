import axios from 'axios';

export const sendOTPSMS = async (firstName: string,  mobile: string, OTP: string): Promise<any> => {
  const template =
    "Dear {#var#} Kindly use this {#var#} otp For Login . thank You For choosing - SOLARHUT (METADEV).";

  // Function to populate the template with dynamic values
  function populateTemplate(template: string, values: string[]): string {
    let index = 0;
    return template.replace(/{#var#}/g, () => values[index++]);
  }

  // Populate the template with the user's name and OTP
  const name = `${firstName}`; // Use actual user name
  const message = populateTemplate(template, [name, OTP]);

  // Example Output: Dear User, kindly use this OTP 123456 for login to your application. Thank you, METSLH.

  const templateid = "1707176327698864461";

  try {
    const params = {
      username: "metadev",
      apikey: process.env.SMSAPIKEY, // Use API key from environment variables
      senderid: "METSLH",
      mobile: mobile,
      message: message,
      templateid: templateid,
    };

    // Call the sendSMS function
    return await sendSMS(params);
  } catch (error) {
    console.error("Error sending OTP SMS:", error);
    throw new Error("Failed to send OTP SMS");
  }
};


const sendSMS = async (params: any): Promise<any> => {
  try {
    const url = "http://wecann.in/v3/api.php";
    console.log("Sending SMS with params:", params);

    // Trigger the API using axios
    const response = await axios.get(url, { params });
    console.log("SMS API Response:", response.data);
    return response.data; // Return the API response
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS");
  }
};